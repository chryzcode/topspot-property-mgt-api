import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { User } from "../models/user.js";
import { Quote } from "../models/quote.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import cloudinary from "cloudinary";
import multer from "multer";

cloudinary.v2.config(process.env.CLOUDINARY_URL);

// Set up Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
  try {
    req.body.user = req.user.userId;
    const { media, description, amount } = req.body;

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

    // Create a quote for the newly created service
    const quote = await Quote.create({
      user: req.user.userId,
      service: service._id,
      description: description,
      estimatedCost: amount,
    });

    // Optionally, populate additional data from the created service and quote
    service = await Service.findOne({ _id: service._id }).populate("user", "fullName avatar userType _id");
    const populatedQuote = await Quote.findOne({ _id: quote._id }).populate("user", "fullName avatar userType _id");

    // Respond with the created service and quote
    res.status(StatusCodes.OK).json({ service, quote: populatedQuote });
  } catch (error) {
    console.error("Error creating service and quote:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "An error occurred while creating the service and quote" });
  }
};

export const editService = async (req, res) => {
  const { serviceId } = req.params;
  const userId = req.user.userId;
  const { media } = req.body;

  let service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new NotFoundError("Service does not exist");
  }

  if (media && media !== service.media) {
    for (let i = 0; i < media.length; i++) {
      try {
        const result = await cloudinary.v2.uploader.upload(media[i].url, {
          folder: "Topspot/Services/Media/",
          use_filename: true,
        });
        media[i].url = result.url; // Replace media URL with Cloudinary URL
      } catch (error) {
        console.error(error);
        throw new BadRequestError({ "error uploading image on cloudinary": error });
      }
    }
  }

  service = await Service.findOneAndUpdate({ _id: serviceId, user: userId }, req.body, {
    new: true,
    runValidators: true,
  }).populate("user", "fullName avatar userType _id");

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

export const approveQuoteByOwner = async (req, res) => {
  const { quoteId } = req.params;
  const { userId } = req.user;

  try {
    // Fetch the user, quote, and service details
    const user = await User.findById(userId);
    const quote = await Quote.findById(quoteId);
    const service = await Service.findById(quote.service);

    // Validate existence of quote and service
    if (!quote) {
      throw new NotFoundError("Quote does not exist");
    }
    if (!service) {
      throw new NotFoundError("Service does not exist");
    }

    // Check if the user is the owner of the service
    if (service.user.toString() !== userId.toString()) {
      throw new UnauthenticatedError("You are not authorized to approve this quote");
    }

    // Check if the service has been paid for
    if (!service.paid) {
      throw new BadRequestError("Service has not been paid for");
    }

    // Approve the quote
    const updatedQuote = await Quote.findByIdAndUpdate(quoteId, { approve: true }, { runValidators: true, new: true });

    // Prepare the update data for the service
    const updateData = {
      amount: quote.estimatedCost,
      description: quote.description,
      status: "ongoing",
    };

    // Update the availability details if provided in the quote
    if (quote.availableFromDate) updateData.availableFromDate = quote.availableFromDate;
    if (quote.availableToDate) updateData.availableToDate = quote.availableToDate;
    if (quote.availableFromTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(quote.availableFromTime)) {
        throw new BadRequestError("Please provide a valid available from time in HH:mm format");
      }
      updateData.availableFromTime = quote.availableFromTime;
    }
    if (quote.availableToTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(quote.availableToTime)) {
        throw new BadRequestError("Please provide a valid available to time in HH:mm format");
      }
      updateData.availableToTime = quote.availableToTime;
    }

    // Update the service with the approved quote details
    const updatedService = await Service.findByIdAndUpdate(quote.service, updateData, {
      runValidators: true,
      new: true,
    });

    res.status(StatusCodes.OK).json({ success: "Quote approved and service updated", service: updatedService });
  } catch (error) {
    console.error("Error approving quote:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while approving the quote" });
  }
};
