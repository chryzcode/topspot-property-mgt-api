import "dotenv/config";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { Payment } from "../models/payment.js";
import { Quote } from "../models/quote.js";
import { User } from "../models/user.js";
import {approveQuoteByOwner} from "../controllers/service.js"
import fetch from "node-fetch";

export const cancelPayment = async (req, res) => {
  const { serviceId } = req.params;
  const service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new BadRequestError("Service does not exist");
  }
  res.status(StatusCodes.OK).json({ success: "Payment process cancelled" });
};

export const successfulPayment = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { userId } = req.user;

    // Validate service existence
    let service = await Service.findOne({ _id: serviceId });
    if (!service) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Service not found" });
    }

    // Validate user existence
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "User not found" });
    }

    // Check if the service has already been paid for
    if (service.paid) {
      return res.status(StatusCodes.OK).json({ message: "Service has already been paid for." });
    }

    // Retrieve the payment record
    let payment = await Payment.findOne({ service: serviceId });
    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Payment record not found" });
    }

    // Fetch payment status from the Checkout Session
    const paymentResponse = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${payment.paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
          accept: "application/json",
        },
      }
    );

    const paymentData = await paymentResponse.json();

    console.log("PayMongo Checkout Session Response:", JSON.stringify(paymentData, null, 2));

    // Validate payment status
    const paymentStatus = paymentData.data.attributes.payments[0].attributes.status;
    console.log("Payment Status:", paymentStatus);

    if (paymentStatus !== "paid") {

      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Payment not successful or incomplete.",
      });
    }

    // Mark the service as paid
    service = await Service.findByIdAndUpdate(
      serviceId,
      { paid: true },
      { new: true, runValidators: true }
    ).populate("user", "fullName avatar userType _id");

    // Update the payment record
    payment = await Payment.findByIdAndUpdate(
      payment._id,
      { paid: true },
      { new: true, runValidators: true }
    );

    // Approve the latest quote if available
    const latestQuote = await Quote.findOne({ service: serviceId }).sort({ createdAt: -1 });

    if (latestQuote) {
      req.params.quoteId = latestQuote._id;
      req.user = { userId: user._id };
      await approveQuoteByOwner(req, res);
      return; // Prevent multiple responses
    }

    // Final success response
    return res.status(StatusCodes.OK).json({ message: "Payment successful", service, payment });
  } catch (error) {
    console.error("Checkout Session Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message || "Internal Server Error" });
  }
};




export const makePayment = async (req, res) => {
  const { serviceId } = req.params;
  const {userId} = req.user;

  try {
    // Fetch the service from the database
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    if (service.paid) {
      return res.status(400).json({ message: "Service has already been paid for" });
    }
    
    const amountWithCharges = service.amount * 1.3
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
            amount: amountWithCharges * 100, // Use service.amount instead of service.price, and ensure it's in cents
            currency: "PHP", // Currency for the service
            description: `Payment for service ${serviceId}`,
            metadata: {
              user_id: userId,
              service_id: serviceId,
            },

            success_url: `${process.env.FRONTEND_URL}`,
            cancel_url: `${process.env.FRONTEND_URL}`,

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

    const latestQuote = await Quote.findOne({ service: serviceId }).sort({ createdAt: -1 });

    const paymentAmount = latestQuote?.estimatedCost || service.amount;

    // Parse the response from PayMongo
    const responseBody = await response.json();
    // If the response is OK, return the checkout URL
    if (response.ok) {
      const payment = Payment.create({
        user: userId,
        service: service.id,
        amount: paymentAmount,
        paymentId: responseBody.data.id,
        paymentMethod: "card",
      });

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
