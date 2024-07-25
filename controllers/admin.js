import { User } from "../models/user.js";
import { Service } from "../models/service.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { Quote } from "../models/quote.js";
import bcrypt from "bcryptjs";

export const getTenantsAndHouseOwners = async (req, res) => {
  const tenantsAndHouseOwners = await User.find({ userType: "houseOwner" || "tenant", verified: true }).sort({
    createdAt: -1,
  });
  res.status(StatusCodes.OK).json({ tenantsAndHouseOwners });
};

export const getAllServices = async (req, res) => {
  const services = await Service.find({}).sort({ createdAt: -1 });
  res.status(StatusCodes.OK).json({ services });
};

export const getServiceQuotes = async (req, res) => {
  const { serviceId } = req.params;
  const service = await Service.findOne({ _id: serviceId });
  if (!service) {
    throw new NotFoundError(`Service does not exist`);
  }
  const quotes = await Quote.find({ service: serviceId });
  res.status(StatusCodes.OK).json({ quotes });
};

export const filterServicesMonthly = async (req, res) => {
  const now = new Date();

  // Get the first and last day of the current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    const services = await Service.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({ services });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const upgradeToHomeOwner = async (req, res) => {
  const { userId } = req.params;
  var user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError(`User not found`);
  }
  user = await User.findOne({ _id: userId }, { userType: "houseOwner" }, { new: true, runValidators: true });
  res.status(StatusCodes.OK).json({ user });
};

export const downgradeToTenant = async (req, res) => {
  const { userId } = req.params;
  var user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError(`User not found`);
  }
  user = await User.findOne({ _id: userId }, { userType: "tenant" }, { new: true, runValidators: true });
  res.status(StatusCodes.OK).json({ user });
};

export const adminCreateCounterOffer = async (req, res) => {
  const { userId } = req.user;
  const { quoteId } = req.params;
  const { description, estimatedCost, currency } = req.body;

  // Fetch the user and quote details
  const user = await User.findById(userId);
  const quote = await Quote.findById(quoteId).populate("service");

  // Validate existence of user and quote
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (!quote) {
    throw new NotFoundError("Quote not found");
  }

  // Fetch the associated service
  const service = quote.service;
  if (!service) {
    throw new NotFoundError("Service not found");
  }

  // Check if the user is an admin
  if (user.userType !== "admin") {
    throw new UnauthenticatedError("Only admins can create a counter offer quote");
  }

  // Validate required fields
  if (!description || !estimatedCost) {
    throw new BadRequestError("Please provide all required fields");
  }

  // Create a new counter offer quote
  const newQuote = await Quote.create({
    user: userId,
    service: service._id,
    description,
    estimatedCost,
    currency: "usd",
  });

  res.status(StatusCodes.CREATED).json({ success: "Counter offer quote created successfully", quote: newQuote });
};

export const adminApproveQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { userId } = req.user;
    const { contractorId } = req.body;

    if (!contractorId) {
      throw new BadRequestError("Please provide the contractorId");
    }

    // Fetch the user, quote, and service details
    const user = await User.findById(userId);
    const quote = await Quote.findById(quoteId).populate("service");
    const contractor = await User.findOne({ _id: contractorId, userType: "contractor" });

    // Validate existence of user, quote, and service
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
    }
    if (!quote) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Quote not found" });
    }
    if (!quote.service) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Service not found" });
    }

    if (!contractor) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Contractor not found" });
    }
    if (user.userType !== "admin") {
      // Ensure that only admin can approve
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Only admin can approve the quote" });
    }

    // Ensure the user is not the owner of the quote or service
    if (userId === quote.user.toString()) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "You cannot approve your own quote" });
    }

    // Approve the quote
    const updatedQuote = await Quote.findByIdAndUpdate(quoteId, { approve: true }, { runValidators: true, new: true });

    // Update the service's contractor, amount, and description
    const updateData = {
      amount: quote.estimatedCost,
      contractor,
      description: quote.description,
    };

    if (quote.availableFromDate) updateData.availableFromDate = quote.availableFromDate;
    if (quote.availableToDate) updateData.availableToDate = quote.availableToDate;
    if (quote.availableFromTime) updateData.availableFromTime = quote.availableFromTime;
    if (quote.availableToTime) updateData.availableToTime = quote.availableToTime;

    const updatedService = await Service.findByIdAndUpdate(quote.service._id, updateData, {
      runValidators: true,
      new: true,
    });

    // Respond with success message
    return res.status(StatusCodes.OK).json({ success: "Quote accepted", updatedQuote, updatedService });
  } catch (error) {
    console.error("Error approving quote:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while approving the quote" });
  }
};

export const adminVerifyContractor = async (req, res) => {
  try {
    const { contractorId } = req.params;
    const { userId } = req.user;

    // Fetch the user and contractor details
    const user = await User.findById(userId);
    const contractor = await User.findById(contractorId);

    // Validate existence of user and contractor
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
    }
    if (!contractor) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Contractor not found" });
    }

    // Check if the user is an admin
    if (user.userType !== "admin") {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Only admins can verify contractor accounts" });
    }

    // Check if the user to be verified is a contractor
    if (contractor.userType !== "contractor") {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Only contractor accounts can be verified" });
    }

    // Verify the contractor's account
    contractor.contractorAccountStatus = "active";
    await contractor.save();

    // Respond with success message
    return res.status(StatusCodes.OK).json({ success: "Contractor account verified successfully", contractor });
  } catch (error) {
    console.error("Error verifying contractor account:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "An error occurred while verifying the contractor account" });
  }
};

export const deleteContractorAccount = async (req, res) => {
  try {
    const { contractorId } = req.params;

    // Find the contractor account
    const contractor = await User.findOne({ _id: contractorId, userType: "contractor" });

    // Check if contractor account exists
    if (!contractor) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Contractor not found" });
    }

    // Delete the contractor account
    await User.deleteOne({ _id: contractorId });

    // Respond with success message
    return res.status(StatusCodes.OK).json({ message: "Contractor account deleted successfully" });
  } catch (error) {
    console.error("Error deleting contractor account:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

export const allContractors = async (req, res) => {
  try {
    const contractors = await User.find({ userType: "contractor" });

    // Iterate over each contractor to get their completed services count
    const contractorsWithServiceCount = await Promise.all(
      contractors.map(async contractor => {
        const completedServicesCount = await Service.countDocuments({
          contractor: contractor._id,
          status: "completed", // Ensure the status is a string
        });
        return {
          ...contractor.toObject(), // Convert Mongoose document to plain JavaScript object
          completedServicesCount,
        };
      })
    );

    res.status(StatusCodes.OK).json({ contractors: contractorsWithServiceCount });
  } catch (error) {
    console.error("Error fetching contractors:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

export const allUsers = async (req, res) => {
  const users = await User.find({});
  res.status(StatusCodes.OK).json({ users });
};

export const createTenantAccount = async (req, res) => {
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "User with this email already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  req.body.password = await bcrypt.hash("default_pword", salt);

  const user = await User.create({ ...req.body, userType: "tenant" });

  res.status(StatusCodes.CREATED).json({
    user,
    message: "Tenant account created successfully",
  });
};

export const getUserProfile = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("-password -token");

  if (!user) {
    throw new NotFoundError(`User with id ${userId} does not exist`);
  }

  res.status(StatusCodes.OK).json({ user });
};
