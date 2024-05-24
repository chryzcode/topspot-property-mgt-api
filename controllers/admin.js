import { User } from "../models/user.js";
import { Service } from "../models/service.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { Quote } from "../models/quote.js";

export const getTenantsAndHouseOwners = async (req, res) => {
  const tenantsAndHouseOwners = await User.find({ userType: "houseOwner" || "tenant", verified: true }).sort({
    createdAt: -1,
  });
  res.status(StatusCodes.OK).json({ tenantsAndHouseOwners });
};

export const getAllServices = async (req, res) => {
  const services = await Service.find({}).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId });
  res.status(StatusCodes.OK).json({ quotes });
};

export const filterServicesMonthly = async (req, res) => {
  const now = new Date();

  // Get the first and last day of the current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    const services = await Service.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({ services });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const upgradeToHomeOwner = async (req, res) => {
  const { userId } = req.params;
  var user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError(`User not found`);
  }
  user = await User.findOne({ _id: userId }, { userType: "houseOwner" }, { new: true, runValidators: true });
  res.status(StatusCodes.OK).json({ user });
};
