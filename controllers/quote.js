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
  const quotes = await Quote.find({ service: serviceId })
    .populate("user", "firstName lastName imageCloudinaryUrl userType _id")
    .populate({
      path: "service",
      select:
        "name categories description currency amount workScope location status availableFromDate availableToDate availableFromTime availableToTime", // Explicitly select fields
      populate: [
        { path: "user", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "contractor", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "media" },
      ],
    });
  res.status(StatusCodes.OK).json({ quotes });
};
