import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { User } from "../models/user.js";
import { Quote } from "../models/quote.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import cloudinary from "cloudinary";
import multer from "multer";
import { sendEmail } from "../utils/mailToken.js";
import { makePayment } from "./payment.js";

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

  const services = await Service.find(query)
    .sort({ createdAt: -1 })
    .skip(pageNumber * pageSize)
    .limit(pageSize);
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
};

export const createService = async (req, res) => {
  const user = await User.findOne({ _id: req.user.userId });
  if (!user) {
    throw new NotFoundError("User does not exist");
  }
  req.body.user = user._id;
  req.body.location = user.addressLine1;

  // Create service in the database
  let service = await Service.create({ ...req.body });

  // Optionally, populate additional data from the created service and quote
  service = await Service.findOne({ _id: service._id }).populate("user", "fullName avatar userType _id");

  // Respond with the created service and quote
  res.status(StatusCodes.OK).json({ service });
};

export const editService = async (req, res) => {
  const { serviceId } = req.params;
  const userId = req.user.userId;

  let service = await Service.findOne({ _id: serviceId, user: userId });
  if (!service) {
    throw new NotFoundError("Service does not exist");
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
  try {
    const { quoteId } = req.params;
    const { userId } = req.user;

    const user = await User.findById(userId);
    const quote = await Quote.findById(quoteId);
    const service = quote ? await Service.findById(quote.service) : null;


    if (!user) throw new NotFoundError("User does not exist");
    if (!quote) throw new NotFoundError("Quote does not exist");
    if (!service) throw new NotFoundError("Service does not exist");

    // 🔐 Check if the user is the owner of the service
      if (service.user.toString() !== userId.toString()) {
        throw new UnauthenticatedError("You are not authorized to approve this quote");
      }

      if (service.paid !== true) {
        req.params.serviceId = service._id; 
        return await makePayment(req, res);
      }
  
    const contractor = await User.findById(service.contractor);


    const updatedQuote = await Quote.findByIdAndUpdate(
      quoteId,
      { approve: "approved" },
      { runValidators: true, new: true }
    );


    const updateData = {
      amount: quote.estimatedCost || service.amount,
      description: quote.description || service.description,
      status: "ongoing",
    };

    // ⏳ Update available dates and times
    if (quote.availableFromDate) updateData.availableFromDate = quote.availableFromDate;
    if (quote.availableToDate) updateData.availableToDate = quote.availableToDate;

    // 🕒 Time validation function
    const validateTime = time => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

    if (quote.availableFromTime) {
      if (!validateTime(quote.availableFromTime)) {
        throw new BadRequestError("Invalid available from time format (HH:mm)");
      }
      updateData.availableFromTime = quote.availableFromTime;
    }

    if (quote.availableToTime) {
      if (!validateTime(quote.availableToTime)) {
        throw new BadRequestError("Invalid available to time format (HH:mm)");
      }
      updateData.availableToTime = quote.availableToTime;
    }

    // 🔄 Update service with approved quote details
    const updatedService = await Service.findByIdAndUpdate(quote.service, updateData, {
      runValidators: true,
      new: true,
    });

    // 📧 Send email notification to contractor and admin
    const mailData = {
      to: [process.env.EMAIL_ADDRESS, contractor.email],
      subject: `${user.firstName} has approved a quote`,
      html: `<p>${user.firstName} has approved a quote for the <strong>${service.name}</strong> service.</p>`,
    };

    await sendEmail(mailData);

    // 🎉 Success response
    res.status(StatusCodes.OK).json({
      success: "Quote approved and service updated",
      service: updatedService,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "An unexpected error occurred",
    });
  }
};



export const ownerDisapproveQuote = async (req, res) => {
  const { userId } = req.user;
  const { quoteId } = req.params;

  // Fetch the user and quote details
  const user = await User.findById(userId);
  let quote = await Quote.findById(quoteId).populate("service");
  let service = await Service.findById(quote.service);

  // Validate existence of user, quote, and service
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!quote) {
    throw new NotFoundError("Quote not found");
  }
  if (!service) {
    throw new NotFoundError("Service not found");
  }

  // Ensure the contractor is assigned to the service
  if (service.user.toString() !== userId.toString()) {
    throw new UnauthenticatedError("Only the owner of the service can disapprove the quote");
  }

  // Disapprove the quote and update the service status to cancelled
  service = await Service.findOneAndUpdate(
    { _id: quote.service },
    { contractor: null, status: "cancelled" },
    { new: true }
  );

  quote = await Quote.findOneAndUpdate({ _id: quoteId }, { approve: "cancelled" });

  // Send email notification to the contractor and admin
  const maildata = {
    to: [process.env.EMAIL_ADDRESS, service.contractor.email],
    subject: `${user.firstName} has disapproved a quote`,
    html: `<p>${user.firstName} has disapproved a quote for the ${service.name} service</p>`,
  };

  await sendEmail(maildata);

  res.status(StatusCodes.OK).json({
    success: "Quote disapproved and service updated",
    service,
    quote,
  });
};


// export const ownerReplyQuote = async (req, res) => {
//   const { userId } = req.user;
//   const { quoteId } = req.params;
//   const { description, estimatedCost } = req.body;

//   // Fetch the user and quote details
//   const user = await User.findById(userId);
//   const quote = await Quote.findById(quoteId).populate("service");
//   const service = quote.service;

//   // Validate existence of user and quote
//   if (!user) {
//     throw new NotFoundError("User not found");
//   }
//   if (!quote) {
//     throw new NotFoundError("Quote not found");
//   }

//   // Ensure the contractor is assigned to the service
//   if (service.user.toString() !== userId.toString()) {
//     throw new UnauthenticatedError("Only the owner of the service can reply to the quote");
//   }

//   // Validate required fields
//   if (!description || !estimatedCost) {
//     throw new BadRequestError("Please provide all required fields: description, estimatedCost");
//   }

//   // Create a new quote with updated information
//   const newQuote = await Quote.create({
//     user: userId,
//     service: quote.service,
//     description,
//     estimatedCost,
//   });

//   res.status(StatusCodes.CREATED).json({ success: "Counter offer quote created successfully", quote: newQuote });
// };
