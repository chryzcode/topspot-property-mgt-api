import { User } from "../models/user.js";
import { Service } from "../models/service.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { Quote } from "../models/quote.js";
import bcrypt from "bcryptjs";
import { transporter } from "../utils/mailToken.js";

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

  const services = await Service.find({
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  }).sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({ services });
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

export const assignContractor = async (req, res) => {
  const { userId } = req.user;
  const { serviceId } = req.params;
  const { contractorId } = req.body;

  // Fetch the user and quote details
  const user = await User.findOne({ _id: userId });
  let service = await Service.findOne({ _id: serviceId });
  const contractor = await User.findOne({ _id: contractorId, userType: "contractor" });

  // Validate existence of user and quote
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (!contractor) {
    throw new NotFoundError("Contractor not found");
  }

  if (!service) {
    throw new NotFoundError("Service not found");
  }

  // Check if the user is an admin
  if (user.userType !== "admin") {
    throw new UnauthenticatedError("Only admins can appoint contractors");
  }

  service = await Service.findOneAndUpdate(
    { _id: serviceId },
    { contractor: contractor._id },
    { runValidators: true, new: true }
  );

  const maildata = {
    from: process.env.EMAIL_ADDRESS,
    to: contractor.email,
    subject: `${contractor.firstName}, a service has been assigned`,
    html: `<p>${contractor.firstName} a new service has been asigned to you as a contractor. Go check it out</p>`,
  };

  transporter.sendMail(maildata, (error, info) => {
    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Failed to send verification email" });
    }

    res.status(StatusCodes.CREATED).json({ success: service });
  });
};

export const adminGetAllQuotes = async (req, res) => {
  // Fetch all quotes
  const quotes = await Quote.find({})
    .populate({
      path: "user",
      select: "firstName lastName email",
    })
    .populate({
      path: "service",
      populate: {
        path: "user",
        select: "firstName lastName email",
      },
    })
    .exec();

  res.status(200).json(quotes);
};
// export const adminApproveQuote = async (req, res) => {
//   const { quoteId } = req.params;
//   const { userId } = req.user;
//   const { contractorId } = req.body;

//   if (!contractorId) {
//     throw new BadRequestError("Please provide the contractorId");
//   }

//   // Fetch the user, quote, and service details
//   const user = await User.findById(userId);
//   const quote = await Quote.findById(quoteId).populate("service");
//   const contractor = await User.findOne({ _id: contractorId, userType: "contractor" });

//   // Validate existence of user, quote, and service
//   if (!user) {
//     return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
//   }
//   if (!quote) {
//     return res.status(StatusCodes.NOT_FOUND).json({ error: "Quote not found" });
//   }
//   if (!quote.service) {
//     return res.status(StatusCodes.NOT_FOUND).json({ error: "Service not found" });
//   }

//   if (!contractor) {
//     return res.status(StatusCodes.NOT_FOUND).json({ error: "Contractor not found" });
//   }
//   if (user.userType !== "admin") {
//     // Ensure that only admin can approve
//     return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Only admin can approve the quote" });
//   }

//   // Ensure the user is not the owner of the quote or service
//   if (userId === quote.user.toString()) {
//     return res.status(StatusCodes.UNAUTHORIZED).json({ error: "You cannot approve your own quote" });
//   }

//   // Approve the quote
//   const updatedQuote = await Quote.findByIdAndUpdate(quoteId, { approve: true }, { runValidators: true, new: true });

//   // Update the service's contractor, amount, and description
//   const updateData = {
//     amount: quote.estimatedCost,
//     contractor,
//     description: quote.description,
//   };

//   if (quote.availableFromDate) updateData.availableFromDate = quote.availableFromDate;
//   if (quote.availableToDate) updateData.availableToDate = quote.availableToDate;
//   if (quote.availableFromTime) updateData.availableFromTime = quote.availableFromTime;
//   if (quote.availableToTime) updateData.availableToTime = quote.availableToTime;

//   const updatedService = await Service.findByIdAndUpdate(quote.service._id, updateData, {
//     runValidators: true,
//     new: true,
//   });

//   // Respond with success message
//   return res.status(StatusCodes.OK).json({ success: "Quote accepted", updatedQuote, updatedService });
// };

export const adminVerifyContractor = async (req, res) => {
  const { contractorId } = req.params;
  const { userId } = req.user;

  // Fetch the user and contractor details
  const user = await User.findById(userId);
  let contractor = await User.findById(contractorId);

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

  // Verify the contractor's account without updating the password field
  contractor = await User.findOneAndUpdate(
    { _id: contractorId },
    { $set: { contractorAccountStatus: "active" } },
    { new: true }
  );

  // Respond with success message
  return res.status(StatusCodes.OK).json({ success: "Contractor account verified successfully", contractor });
};

export const deleteContractorAccount = async (req, res) => {
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
};

export const allContractors = async (req, res) => {
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
};

export const allUsers = async (req, res) => {
  const users = await User.find({});
  res.status(StatusCodes.OK).json({ users });
};

export const createTenantAccount = async (req, res) => {
  const { email, lodgeName, tenantRoomNumber } = req.body;

  // Check if the required fields are present
  if (!lodgeName || !tenantRoomNumber) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Lodge name and tenant room number are required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "User with this email already exists" });
  }

  // Sanitize lodgeName and tenantRoomNumber to remove spaces
  const sanitizedLodgeName = lodgeName.replace(/\s+/g, "");
  const sanitizedTenantRoomNumber = tenantRoomNumber.replace(/\s+/g, "");

  // Create the tenantId with the concatenated lodgeName and tenantRoomNumber
  const tenantId = `${sanitizedLodgeName}${sanitizedTenantRoomNumber}`;

  // Check if a user with the same tenantId already exists
  const existingTenant = await User.findOne({ tenantId });
  if (existingTenant) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Tenant ID already exists. Please choose another room or lodge." });
  }

  // Hash the default password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("default_pword", salt);

  // Create the user
  const user = await User.create({
    ...req.body,
    tenantId,
    password: hashedPassword,
    userType: "tenant",
  });

  const maildata = {
    from: process.env.EMAIL_ADDRESS,
    to: user.email,
    subject: `${user.firstName},tenant account had been created`,
    html: `<p>${user.firstName} your tenent account has been created. You can go ahead to login</p>`,
  };

  transporter.sendMail(maildata, (error, info) => {
    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Failed to send verification email" });
    }

    res.status(StatusCodes.CREATED).json({
      user,
      message: "Tenant account created successfully",
    });
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
