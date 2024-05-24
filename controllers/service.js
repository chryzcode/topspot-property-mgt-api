import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const userServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ user: userId }).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const userOngoingServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ user: userId, status: "ongoing" }).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const userPendingServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ user: userId, status: "pending" }).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const userCompletedServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ user: userId, status: "completed" }).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const userCancelledServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ user: userId, status: "cancelled" }).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const filterUserServicesMonthly = async (req, res) => {
  const { userId } = req.user;
  const now = new Date();

  // Get the first and last day of the current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    const services = await Service.find({
      user: userId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({ services });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};
