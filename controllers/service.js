import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const userServices = async (req, res) => {
  const { userId } = req.user;
  const { date, status, page, limit } = req.query;

  let query = { user: userId };

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
        query.$or = [{ availableFromDate: { $gte: date } }, { availableToDate: { $gte: date } }];
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
