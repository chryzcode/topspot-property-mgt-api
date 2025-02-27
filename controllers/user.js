import { User } from "../models/user.js";
import { StatusCodes } from "http-status-codes";
import { sendEmail, generateToken } from "../utils/mailToken.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { uploadToCloudinary } from "../utils/cloudinaryConfig.js";
import { Quote } from "../models/quote.js";

const uniqueID = uuidv4();
const domain = process.env.DOMAIN || "http://localhost:8000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const linkVerificationtoken = generateToken(uniqueID);

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError("Put in your email and password");
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw new UnauthenticatedError("User does not exist");
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      throw new UnauthenticatedError("Invalid password");
    }

    // Ensure the user is verified before allowing login
    if (!user.verified) {
      const verificationToken = user.createJWT();
      const verificationLink = `${FRONTEND_URL}/register?stage=verify&id=${user.id}&token=${encodeURIComponent(
        verificationToken
      )}`;

      const mailData = {
        to: user.email,
        subject: `${user.firstName}, verify your account`,
        html: `<p>Please use the following <a href="${verificationLink}">link</a> to verify your account. The link expires in 10 minutes.</p>`,
      };

      try {
        await sendEmail(
          user.email,
          `${user.firstName}, verify your account`,
          `<p>Please use the following <a href="${verificationLink}">link</a> to verify your account. The link expires in 10 minutes.</p>`
        );

        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: "Your account is not verified. A new verification link has been sent to your email.",
        });
      } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: "Failed to send verification email. Please try again later.",
        });
      }
    }

    // Ensure contractor accounts are active before login
    if (user.userType === "contractor" && user.contractorAccountStatus !== "active") {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Your contractor account is not active. Please contact support.",
      });
    }

    // Ensure tenants and homeowners are admin-verified before login
    if ((user.userType === "tenant" || user.userType === "homeowner") && !user.adminVerified) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Your account is not verified by the admin. Please contact support.",
      });
    }

    // Generate token and update user record
    const token = user.createJWT();
    await User.findByIdAndUpdate(user._id, { token });

    return res.status(StatusCodes.OK).json({ user, token });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  const { userId } = req.user;
  req.body.token = "";
  await User.findOneAndUpdate({ _id: userId }, req.body);
  res.status(StatusCodes.OK).json({ success: "Successfully logged out" });
};

export const signUp = async (req, res) => {
  // Prevent creation of tenant accounts through sign-up

  const { email, userType, lodgeName, tenantRoomNumber } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "User with this email already exists" });
  }

  let tenantId = null; // Ensure tenantId is properly scoped

  if (userType === "tenant") {
    if (!lodgeName || !tenantRoomNumber) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Lodge name and room number are required for tenants" });
    }

    // Generate unique tenantId
    const sanitizedLodgeName = lodgeName.replace(/\s+/g, "").toLowerCase();
    const sanitizedTenantRoomNumber = tenantRoomNumber.replace(/\s+/g, "");
    tenantId = `${sanitizedLodgeName}${sanitizedTenantRoomNumber}`;

    // Ensure tenantId is unique
    const existingTenant = await User.findOne({ tenantId });
    if (existingTenant) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Tenant ID already exists. Choose another room or lodge." });
    }
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  req.body.password = await bcrypt.hash(req.body.password, salt);

  // Create the user
  const user = await User.create({
    ...req.body,
    tenantId, // Only assigned if user is a tenant
    addressLine1: req.body.addressLine1 || " ",
  });

  const linkVerificationToken = user.createJWT(); // Assuming this generates the token for email verification

  try {
    // Send verification email
    await sendEmail(
      user.email,
      `${user.firstName}, verify your account`,
      `<p>Please use the following <a href="${FRONTEND_URL}/register?stage=verify&id=${
        user.id
      }&token=${encodeURIComponent(
        linkVerificationToken
      )}">link</a> to verify your account. The link expires in 10 mins.</p>`
    );
    const token = user.createJWT();
    return res.status(StatusCodes.CREATED).json({
      user,
      token,
      message: "Check your email for account verification, admin will verify your account soon",
    });
  } catch (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Failed to send verification email" });
  }
};


export const verifyAccount = async (req, res) => {
  const { token, id } = req.query; // Correctly extract token and userId
  const secretKey = process.env.JWT_SECRET;

  // Check if token and userId are provided
  if (!token) {
    console.error("Token is not provided");
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Token is required" });
  }

  if (!id) {
    console.error("User ID is not provided");
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "User ID is required" });
  }

  try {
    const decoded = jwt.verify(token, secretKey); // Verify the token
    console.log("Token decoded successfully:", decoded);

    const user = await User.findOneAndUpdate({ _id: id }, { verified: true }, { new: true, runValidators: true });

    if (!user) {
      console.error("User not found");
      return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
    }

    // Redirect to the desired route after successful verification
    res.status(StatusCodes.OK).json({ success: "Account verified successfully, you have to wait for admin approval" });
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(StatusCodes.BAD_REQUEST).json({ error: error });
  }
};

export const currentUser = async (req, res) => {
  const { userId } = req.user;
  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new UnauthenticatedError("No account is currently logged in or User does not exist");
  }
  res.status(StatusCodes.OK).json({ user });
};

export const getUser = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError(`User does not exist`);
  }
  res.status(StatusCodes.OK).json({ user });
};

export const updateUserAvatar = async (req, res) => {
  const { userId } = req.user;

  let user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(`User does not exist`);
  }

  if (req.file) {
    try {
      const result = await uploadToCloudinary(req.file);
      req.body.avatar = result.secure_url;
    } catch (error) {
      console.error("Error uploading avatar to Cloudinary:", error);
      return res.status(400).json({ error: "Error uploading avatar to Cloudinary" });
    }
  }

  user.avatar = req.body.avatar;

  res.status(StatusCodes.OK).json({ user });
};

export const updateUser = async (req, res) => {
  const { userId } = req.user;

  // Find the user
  let user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError("User does not exist");
  }

  // Handle password change if currentPassword and newPassword are provided
  if (req.body.currentPassword && req.body.newPassword) {
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      throw new UnauthenticatedError("Current password is incorrect");
    }
    const salt = await bcrypt.genSalt(10);
    req.body.password = await bcrypt.hash(req.body.password, salt);
    delete req.body.currentPassword;
    delete req.body.newPassword;
  }

  // Update user details
  user = await User.findOneAndUpdate({ _id: userId }, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(StatusCodes.OK).json({ user });
};

export const deleteUser = async (req, res) => {
  const { userId } = req.user;
  const user = await User.findOneAndUpdate({ _id: userId }, { verified: false }, { new: true, runValidators: true });
  if (!user) {
    throw new NotFoundError(`User with id ${userId} does not exist`);
  }
  res.status(StatusCodes.OK).json({ success: "Acccount successfully disabled" });
};

export const sendForgotPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError("Email field is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError("User does not exist");
    }

    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30m" });
    const resetLink = `${FRONTEND_URL}/register?stage=create-password&id=${user.id}&token=${encodeURIComponent(
      resetToken
    )}`;

    try {
      await sendEmail(
        user.email,
        `${user.firstName}, reset your password`,
        `<p>Please use the following <a href="${resetLink}">link</a> to reset your password. The link expires in 30 minutes.</p>`
      );
      res.status(StatusCodes.OK).json({ success: "Check your email to change your password" });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to send reset password email" });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};


export const verifyForgotPasswordToken = async (req, res) => {
  const { id, token } = req.query;
  const { password } = req.body;

  if (!id || !token) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing required query parameters" });
  }

  if (!password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Password is required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.userId !== id) {
      throw new UnauthenticatedError("Token does not match the user ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update the user's password
    await User.updateOne({ _id: id }, { password: hashedPassword });

    return res.status(StatusCodes.OK).json({ message: "Password updated successfully" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Token expired" });
    } else {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Invalid token" });
    }
  }
};

export const chooseUserType = async (req, res) => {
  const { userId } = req.params;
  var user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError("User does not exists");
  }
  const { userType } = req.body;
  user = await User.findOneAndUpdate({ _id: userId }, { userType: userType }, { new: true, runValidators: true });
  res.status(StatusCodes.OK).json({ user });
};

export const getUserQuotes = async (req, res) => {
  const { userId } = req.user; // Assuming user ID is available in req.user

  // Fetch all quotes related to the services of the logged-in user
  const quotes = await Quote.find({})
    .populate({
      path: "user",
      select: "firstName lastName email",
    })
    .populate({
      path: "service",
      match: { user: userId }, // Ensure the service belongs to the logged-in user
      populate: {
        path: "user",
        select: "firstName lastName email",
      },
    })
    .exec();

  // Filter out quotes where the service is null (i.e., does not belong to the logged-in user)
  const filteredQuotes = quotes.filter(quote => quote.service);

  res.status(200).json(filteredQuotes);
};
