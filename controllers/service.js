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
