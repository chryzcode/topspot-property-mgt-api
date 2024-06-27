import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import cloudinary from "cloudinary";

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
  let { category, location, date, priceMin, priceMax, page, limit, name } = req.query;

  // Convert search parameters to lowercase and parse as needed
  category = category ? category.toLowerCase() : null;
  location = location ? location.toLowerCase() : null;
  date = date ? new Date(date) : null;
  priceMin = priceMin ? parseFloat(priceMin) : null;
  priceMax = priceMax ? parseFloat(priceMax) : null;
  page = parseInt(page) || 0;
  limit = parseInt(limit) || 10;
  name = name ? name.toLowerCase() : null;

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

    if (name) {
      query.name = { $regex: new RegExp(name, "i") };
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

export const createService = async (req, res) => {
  req.body.user = req.user.userId;
  const { media } = req.body;

    // Upload media files to Cloudinary if they exist
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const result = await cloudinary.v2.uploader.upload(media[i].url, {
          folder: "Topspot/Services/Media/",
          use_filename: true,
        });
        media[i].url = result.url; // Replace media URL with Cloudinary URL
      }
    }

    // Create service in the database
    let service = await Service.create({ ...req.body });

    // Optionally, populate additional data from the created service
    service = await Service.findOne({ _id: service._id }).populate("user", "fullName avatar username userType _id");

    // Respond with the created service
    res.status(StatusCodes.OK).json({ service });
  } 

export const editService = async (req, res) => {
  const { serviceId } = req.params;
  const userId = req.user.userId;
  const media = req.body.media;

  var service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  if (media !== service.media) {
    for (let i = 0; i < media.length; i++) {
      try {
        const result = await cloudinary.v2.uploader.upload(media[i].url, {
          folder: "Topspot/Services/Media/",
          use_filename: true,
        });
        media[i].url = result.url; // Replace media URL w
      } catch (error) {
        console.error(error);
        throw new BadRequestError({ "error uploading image on cloudinary": error });
      }
    }
  }

  service = await Service.findOneAndUpdate({ _id: serviceId, user: userId }, req.body, {
    new: true,
    runValidators: true,
  }).populate("user", "fullName avatar username userType _id");

  res.status(StatusCodes.OK).json({ service });
};


export const completeService = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;

  // Fetch the service details
  const service = await Service.findOne({ _id: serviceId, user: userId });

  // Validate existence of service
  if (!service) {
    throw new NotFoundError("Service does not exist");
  }

  // Update the service status to completed
  const updatedService = await Service.findOneAndUpdate(
    { _id: serviceId },
    { status: "completed" },
    { runValidators: true, new: true }
  );

  res.status(StatusCodes.OK).json({ service: updatedService });
};