import "dotenv/config";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { Quote } from "../models/quote.js";
import { User } from "../models/user.js";
import { sendEmail } from "../utils/mailToken.js";


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

  const services = await Service.find(query)
    .sort({ createdAt: -1 })
    .skip(pageNumber * pageSize)
    .limit(pageSize);
  res.status(StatusCodes.OK).json({ services });
};

export const completedServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ contractor: userId, status: "completed" });
  res.status(StatusCodes.OK).json({ services });
};

export const allContractorServices = async (req, res) => {
  const { userId } = req.user;
  const services = await Service.find({ contractor: userId });
  res.status(StatusCodes.OK).json({ services });
};

export const contractorApproveQuote = async (req, res) => {
  const { quoteId } = req.params;
  const { userId } = req.user;
  const { availableFromDate, availableToDate, availableFromTime, availableToTime } = req.body;

  // Fetch the user, quote, and service details
  const user = await User.findById(userId);
  const quote = await Quote.findById(quoteId).populate("service");
  const service = quote.service;

  // Validate existence of user, quote, and service
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  }
  if (!quote) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Quote not found" });
  }
  if (!service) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Service not found" });
  }

  const serviceOwner = await User.findOne({ _id: service.user });

  // Check if the user is a contractor
  if (user.userType !== "contractor") {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Only contractors can approve the quote and set the service period" });
  }

  // Ensure the contractor is not approving their own quote
  if (quote.user.toString() === userId.toString()) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "You cannot approve your own quote" });
  }

  // Ensure the contractor is assigned to the service
  if (service.contractor.toString() !== userId.toString()) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Only the assigned contractor can approve the quote" });
  }

  // Check if the required availability details are provided
  if (!availableFromDate || !availableToDate || !availableFromTime || !availableToTime) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Please provide all required availability details" });
  }

  // Approve the quote
  const updatedQuote = await Quote.findByIdAndUpdate(
    quoteId,
    { approve: "approved" },
    { runValidators: true, new: true }
  );

  // Update the service's contractor, amount, and availability period
  const updatedService = await Service.findByIdAndUpdate(
    quote.service,
    {
      amount: quote.estimatedCost,
      availableFromDate,
      availableToDate,
      availableFromTime,
      availableToTime,
      status: "ongoing",
    },
    { runValidators: true, new: true }
  );

  const maildata = {
    to: [process.env.EMAIL_ADDRESS, serviceOwner.email],
    subject: `${user.firstName}, has approved inspection  date`,
    html: `<p>${user.firstName} has approved inspection  date for ${service.name}</p>`,
  };

  await sendEmail(maildata);
    // Respond with success message
    return res.status(StatusCodes.OK).json({
      success: "Quote accepted and service period updated",
    updatedQuote,
    updatedService,
  });
};


export const contractorCreateQuote = async (req, res) => {
  const { userId } = req.user;
  const { serviceId } = req.params;
  const { description, estimatedCost, availableFromDate, availableToDate, availableFromTime, availableToTime } =
    req.body;

  // Fetch the user and quote details
  const user = await User.findById(userId);
  const service = await Service.findById(serviceId);

  // Validate existence of user and quote
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!service) {
    throw new NotFoundError("Service not found");
  }

  // Check if the user is a contractor
  if (user.userType !== "contractor") {
    throw new UnauthenticatedError("Only contractors can do this");
  }

  // Ensure the contractor is assigned to the service
  if (service.contractor.toString() !== userId.toString()) {
    throw new UnauthenticatedError("Only the assigned contractor can reply to the quote");
  }

  // Validate required fields
  if (
    !description ||
    !estimatedCost ||
    !availableFromDate ||
    !availableToDate ||
    !availableFromTime ||
    !availableToTime
  ) {
    throw new BadRequestError(
      "Please provide all required fields: description, estimatedCost, availableFromDate, availableToDate, availableFromTime, availableToTime"
    );
  }

  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(availableFromTime) || !timeRegex.test(availableToTime)) {
    throw new BadRequestError("Please provide a valid time in HH:mm format");
  }

  // Increase the estimated amount by 30 percent
  const increasedEstimatedCost = (parseFloat(estimatedCost) * 1.3).toFixed(2);

  // Create a new quote with updated information
  const newQuote = await Quote.create({
    user: userId,
    service: service._id,
    description,
    estimatedCost: increasedEstimatedCost,
    availableFromDate,
    availableToDate,
    availableFromTime,
    availableToTime,
  });

  res.status(StatusCodes.CREATED).json({ success: "Counter offer quote created successfully", quote: newQuote });
};

export const getCompletedServicesTotal = async (req, res) => {
  const { userId } = req.user;

  // Find all completed services for the current contractor
  const completedServices = await Service.aggregate([
    {
      $match: {
        contractor: userId,
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Check if there are completed services
  const totalAmount = completedServices.length > 0 ? completedServices[0].totalAmount : 0;

  res.status(StatusCodes.OK).json({
    success: true,
    totalAmount,
  });
};
