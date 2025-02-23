import "dotenv/config";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { Payment } from "../models/payment.js";
import { Quote } from "../models/quote.js";
import {approveQuoteByOwner} from "../controllers/service.js"
import fetch from "node-fetch";

export const cancelPayment = async (req, res) => {
  const { serviceId, userId } = req.params;
  const service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new BadRequestError("Service does not exist");
  }
  res.status(StatusCodes.OK).json({ success: "Payment process cancelled" });
};

export const successfulPayment = async (req, res) => {
  try {
    const { serviceId, userId } = req.params;

    let service = await Service.findOne({ _id: serviceId });
    if (!service) {
      throw new NotFoundError(`Service not found`);
    }

    // Check if the service has already been paid for
    const alreadyPaid = await Service.findOne({ _id: serviceId, paid: true });
    if (alreadyPaid) {
      return res.status(StatusCodes.OK).send(`Service has been paid for already`);
    }

    // Mark the service as paid
    service = await Service.findOneAndUpdate(
      { _id: serviceId },
      { paid: true },
      {
        new: true,
        runValidators: true,
      }
    ).populate("user", "fullName avatar userType _id");

    // Handle payment record creation
    let payment = await Payment.findOne({ user: userId, service: serviceId, paid: true });
    if (!payment) {
      payment = await Payment.create({
        user: userId,
        service: service.id,
        paid: true,
      });
    }

    // Populate user data in payment
    payment = await Payment.findOne({ user: userId, service: serviceId, paid: true }).populate(
      "user",
      "fullName avatar userType _id"
    );

    // Get the latest quote and approve it
    const latestQuote = await Quote.findOne({ service: serviceId }).sort({ createdAt: -1 });
    if (latestQuote) {
      req.params.quoteId = latestQuote._id;
      await approveQuoteByOwner(req, res);
      return; // Prevent sending multiple responses
    }

    // Send the final response if everything was successful
    res.status(StatusCodes.OK).json({ service, payment });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};


export const makePayment = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user; // Assuming authentication middleware attaches user to req

  try {
    // Fetch the service from the database
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    if (service.paid) {
      return res.status(400).json({ message: "Service has already been paid for" });
    }
    // Create a Checkout session with PayMongo
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: service.amount * 100, // Use service.amount instead of service.price, and ensure it's in cents
            currency: "PHP", // Currency for the service
            description: `Payment for service ${serviceId}`,
            metadata: {
              user_id: userId,
              service_id: serviceId,
            },

            success_url: `${process.env.FRONTEND_URL}/payment-success/${userId}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-failure/${userId}`,

            line_items: [
              {
                amount: service.amount * 100, // Ensure this is in cents
                currency: "PHP", // Currency for the service
                name: service.name, // Name of the service
                quantity: 1, // Number of items (1 in this case)
              },
            ],
            payment_method_types: ["card"], // Define payment methods allowed
          },
        },
      }),
    });

    // Parse the response from PayMongo
    const responseBody = await response.json();
    // If the response is OK, return the checkout URL
    if (response.ok) {
      return res.status(200).json({ checkoutUrl: responseBody.data.attributes.checkout_url });
    } else {
      return res.status(response.status).json({
        message: responseBody.errors?.[0]?.detail || "Unknown error from PayMongo",
      });
    }
  } catch (error) {
    console.error("Error during payment creation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
