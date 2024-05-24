import { Quote } from "../models/quote.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;
  const service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId });
  res.status(StatusCodes.OK).json({ quotes });
};

export const approveQuote = async (req, res) => {
  const { quoteId } = req.params;
  const { userId } = req.user;
  let quote = await Quote.findOne({ _id: quoteId, user: userId });
  if (!quote) {
    throw new NotFoundError(`Quote does not exist`);
  }

  quote = await Quote.findOneAndUpdate(
    { _id: quoteId, user: userId },
    { approve: true },
    { runValidators: true, new: true }
  );

  let service = await Service.findOne({ _id: quote.service, user: userId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }

  quote = await Service.findOneAndUpdate(
    { _id: quote.service, user: userId },
    { amount: quote.estimatedCost },
    { runValidators: true, new: true }
  );
  res.status(StatusCodes.OK).json({ quote, service });
};

