import { Quote } from "../models/quote.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId });
  res.status(StatusCodes.OK).json({ quotes });
};
