import { Quote } from "../models/quote.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { User } from "../models/user.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;
  const service =
    (await Service.findOne({ _id: serviceId, user: userId })) ||
    (await Service.findOne({ _id: serviceId, contractor: userId }));
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId });
  res.status(StatusCodes.OK).json({ quotes });
};

import { StatusCodes } from "http-status-codes";
import { NotFoundError, UnauthenticatedError } from "../errors";
import User from "../models/user";
import Quote from "../models/quote";
import Service from "../models/service";

export const approveQuote = async (req, res) => {
  const { quoteId } = req.params;
  const { userId } = req.user;

  // Fetch the user, quote, and service details
  const user = await User.findOne({ _id: userId });
  const quote = await Quote.findOne({ _id: quoteId });
  const service = await Service.findOne({ _id: quote.service });

  // Validate existence of quote and service
  if (!quote) {
    throw new NotFoundError("Quote does not exist");
  }
  if (!service) {
    throw new NotFoundError("Service does not exist");
  }

  // Check if the user is authenticated to approve
  if (userId !== service.user && user.userType !== "contractor") {
    throw new UnauthenticatedError("You are not authenticated to approve");
  }

  // Check if the user is not the owner of the quote
  if (userId === quote.user) {
    throw new UnauthenticatedError("You cannot approve your own quote");
  }

  // Approve the quote
  const updatedQuote = await Quote.findOneAndUpdate(
    { _id: quoteId },
    { approve: true },
    { runValidators: true, new: true }
  );

  // Update the service's contractor and amount
  let updatedService;
  if (user.userType === "contractor") {
    // If a contractor approved the quote, save the contractor to the service
    updatedService = await Service.findOneAndUpdate(
      { _id: quote.service },
      { amount: quote.estimatedCost, contractor: userId },
      { runValidators: true, new: true }
    );
  } else if (userId === service.user) {
    // If the service owner approved the quote, save the quote's user as the contractor
    updatedService = await Service.findOneAndUpdate(
      { _id: quote.service },
      { amount: quote.estimatedCost, contractor: quote.user },
      { runValidators: true, new: true }
    );
  }

  res.status(StatusCodes.OK).json({ quote: updatedQuote, service: updatedService });
};



