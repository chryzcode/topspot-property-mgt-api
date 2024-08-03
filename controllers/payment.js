import "dotenv/config";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { Payment } from "../models/payment.js";
import { User } from "../models/user.js";
import stripePackage from "stripe";

const stripe = new stripePackage(process.env.STRIPE_SECRET_KEY);
const DOMAIN = process.env.DOMAIN;

export const cancelPayment = async (req, res) => {
  const { serviceId, userId } = req.params;
  const service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new BadRequestError("Service does not exist");
  }
  res.status(StatusCodes.OK).json({ success: "payment process cancelled" });
};

export const successfulPayment = async (req, res) => {
  const { serviceId, userId } = req.params;

  let service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new NotFoundError(`Service not found`);
  }

  if (await Service.findOne({ _id: serviceId, paid: true })) {
    res.status(StatusCodes.OK).send(`Service has been paid for already`);
  } else {
    service = await Service.findOneAndUpdate(
      { _id: serviceId },
      { paid: true },
      {
        new: true,
        runValidators: true,
      }
    ).populate("user", "fullName avatar userType _id");

    var payment = await Payment.findOne({ user: userId, service: serviceId, paid: true });
    if (!payment) {
      payment = await Payment.create({
        user: userId,
        service: service.id,
        paid: true,
      });
    }
    payment = await Payment.findOne({ user: userId, service: serviceId, paid: true }).populate(
      "user",
      "fullName avatar userType _id"
    );

    res.status(StatusCodes.OK).json({ service, payment });
  }
};

export const makePayment = async (req, res) => {
  const { userId } = req.user;
  const user = await User.findOne({ _id: userId });
  const { serviceId } = req.params;

  let service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new NotFoundError(`Service not found`);
  }
  req.body.user = user.id;
  req.body.amount = service.amount;
  req.body.service = service.id;
  await Payment.create({ ...req.body });
  const successUrl = `${DOMAIN}/payment/${service.id}/success/${userId}`;
  const cancelUrl = `${DOMAIN}/payment/${service.id}/cancel/${userId}`;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], // Payment method types accepted (e.g., card)
      line_items: [
        {
          price_data: {
            currency: service.currency,
            product_data: {
              name: `${service.name} service`, // Name of your product or service
            },
            unit_amount: service.amount * 100, // Amount in cents
          },
          quantity: 1, // Quantity of the product
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    res.status(StatusCodes.OK).json({ success: session.url });
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(StatusCodes.BAD_REQUEST).json({ error: "payment link not created" });
  }
};
