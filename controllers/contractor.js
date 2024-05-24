import "dotenv/config";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { Payment } from "../models/payment.js";
import { User } from "../models/user.js";

export const contractorServices = async (req, res) => {
  const { userId } = req.user;
  const { date, status, page, limit } = req.query;

  let query = { contractor: userId };

  if (date) {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      query.availableFromDate = { $lte: parsedDate };
      query.availableToDate = { $gte: parsedDate };
    } else {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid date format" });
    }
  }

  if (status) {
    query.status = status;
  }

  const pageNumber = parseInt(page) || 0;
  const pageSize = parseInt(limit) || 10;

  try {
    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .skip(pageNumber * pageSize)
      .limit(pageSize);
    res.status(StatusCodes.OK).json({ services });
  } catch (error) {
    console.error("Error fetching user services:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

export const completedServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ contractor: userId, status: completed });
  res.status(StatusCodes.OK).json({ services });
};

export const allContractorServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ contractor: userId });
  res.status(StatusCodes.OK).json({ services });
};
