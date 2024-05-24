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

export const cancelService = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;

  let service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }

  service = await Service.findOneAndUpdate(
    { _id: serviceId, user: userId },
    { status: "cancelled" },
    { runValidators: true, new: true }
  );
  res.status(StatusCodes.OK).json({ service });
};


export const searchServices = async (req, res) => {
  let { category, location, date, priceMin, priceMax, page, limit } = req.query;

  // Convert search parameters to lowercase and parse as needed
  category = category ? category.toLowerCase() : null;
  location = location ? location.toLowerCase() : null;
  date = date ? new Date(date) : null;
  priceMin = priceMin ? parseFloat(priceMin) : null;
  priceMax = priceMax ? parseFloat(priceMax) : null;
  page = parseInt(page) || 0;
  limit = parseInt(limit) || 10;

  try {
    let query = {};

    // Add search conditions based on provided parameters
    if (category) {
      query.categories = { $regex: new RegExp(category, "i") };
    }

    if (location) {
      // Split location into words and search for each word in the location field
      const locationWords = location.split(" ");
      query.location = {
        $regex: new RegExp(locationWords.join("|"), "i"),
      };
    }

    if (date) {
      if (!isNaN(date.getTime())) {
        query.availableFromDate = { $gte: date };
      } else {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid date format" });
      }
    }

    if (priceMin !== null && priceMax !== null) {
      query.amount = { $gte: priceMin, $lte: priceMax };
    } else if (priceMin !== null) {
      query.amount = { $gte: priceMin };
    } else if (priceMax !== null) {
      query.amount = { $lte: priceMax };
    }

    // Execute the query with pagination
    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);

    res.status(StatusCodes.OK).json({ services });
  } catch (error) {
    console.error("Error searching services:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};