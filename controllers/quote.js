import { Quote } from "../models/quote.js";
import { StatusCodes } from "http-status-codes";
import { Service } from "../models/service.js";
import { User } from "../models/user.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;
  const service =
    (await Service.findOne({ _id: serviceId, user: userId })) ||
    (await Service.findOne({ _id: serviceId, contractor: userId }));
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId })
    .populate("user", "firstName lastName imageCloudinaryUrl userType _id")
    .populate({
      path: "service",
      select:
        "name categories description currency amount workScope location status availableFromDate availableToDate availableFromTime availableToTime", // Explicitly select fields
      populate: [
        { path: "user", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "contractor", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "media" },
      ],
    });
  res.status(StatusCodes.OK).json({ quotes });
};

export const createQuote = async (req, res) => {
  const { serviceId } = req.params;
  const { userId } = req.user;

  const user = await User.findOne({ _id: userId });
  const service = await Service.findOne({ _id: serviceId }).populate("user contractor media");

  if (!service) {
    throw new NotFoundError("Service does not exist");
  }

  // Check if the user is authenticated to approve
  if (userId !== service.user._id.toString() && user.userType !== "contractor") {
    throw new UnauthenticatedError("You are not authenticated to create quote");
  }

  req.body.user = userId;
  req.body.service = serviceId;
  let quote = await Quote.create({ ...req.body });

  quote = await Quote.findOne({ _id: quote._id })
    .populate("user", "firstName lastName imageCloudinaryUrl userType _id")
    .populate({
      path: "service",
      select:
        "name categories description currency amount workScope location status availableFromDate availableToDate availableFromTime availableToTime", // Explicitly select fields
      populate: [
        { path: "user", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "contractor", select: "firstName lastName imageCloudinaryUrl userType _id" },
        { path: "media" },
      ],
    });

  res.status(StatusCodes.CREATED).json({ quote });
};

export const approveQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { userId } = req.user;

    // Fetch the user, quote, and service details
    const user = await User.findById(userId);
    const quote = await Quote.findById(quoteId);
    const service = await Service.findById(quote.service);

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

    // Ensure the user is the owner of the service
    if (service.user.toString() !== userId.toString()) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Only the owner of the service can approve the quote" });
    }

    // Ensure the service has been paid for
    if (!service.paid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Service has not been paid for" });
    }

    // Approve the quote
    const updatedQuote = await Quote.findByIdAndUpdate(quoteId, { approve: true }, { runValidators: true, new: true });

    // Update the service with the quote details
    const updateData = {
      amount: quote.estimatedCost,
      contractor: quote.user,
      description: quote.description,
    };

    // Check if the quote includes availability details
    if (quote.availableFromDate) updateData.availableFromDate = quote.availableFromDate;
    if (quote.availableToDate) updateData.availableToDate = quote.availableToDate;
    if (quote.availableFromTime) updateData.availableFromTime = quote.availableFromTime;
    if (quote.availableToTime) updateData.availableToTime = quote.availableToTime;

    const updatedService = await Service.findByIdAndUpdate(quote.service, updateData, {
      runValidators: true,
      new: true,
    });

    // Respond with success message
    return res.status(StatusCodes.OK).json({
      success: "Quote approved and service updated",
      updatedQuote,
      updatedService,
    });
  } catch (error) {
    console.error("Error approving quote:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while approving the quote" });
  }
};

export const declineQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { userId } = req.user;

    // Fetch the user, quote, and service details
    const user = await User.findById(userId);
    const quote = await Quote.findById(quoteId);
    const service = await Service.findById(quote.service);

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

    // Ensure the user is the owner of the service
    if (service.user.toString() !== userId.toString()) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Only the owner of the service can decline the quote" });
    }

    // Decline the quote
    await Quote.findByIdAndDelete(quoteId);

    // Respond with success message
    return res.status(StatusCodes.OK).json({ success: "Quote declined" });
  } catch (error) {
    console.error("Error declining quote:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while declining the quote" });
  }
};
