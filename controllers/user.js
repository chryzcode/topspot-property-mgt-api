import { User } from "../models/user.js";
import { StatusCodes } from "http-status-codes";
import { transporter, generateToken } from "../utils/mailToken.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import bcrypt from "bcryptjs";
import multer from "multer";
import nodemailer from "nodemailer";

cloudinary.v2.config(process.env.CLOUDINARY_URL);

// Set up Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

const uniqueID = uuidv4();
const domain = process.env.DOMAIN || "http://localhost:8000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const linkVerificationtoken = generateToken(uniqueID);

export const signIn = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Put in your email and password");
  }

  const user = await User.findOne({ email: email });

  if (!user) {
    throw new UnauthenticatedError("User does not exist");
  }

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) {
    throw new UnauthenticatedError("Invalid password");
  }

  if (!user.verified) {
    if (user.userType === "contractor") {
      throw new UnauthenticatedError("Account is not approved yet.");
    } else if (user.userType === "tenant") {
      const linkVerificationtoken = user.createJWT();
      const maildata = {
        from: process.env.Email_User,
        to: user.email,
        subject: `${user.firstName}, reset your password`,
        html: `<p>Please use the following <a href="${domain}/auth/forgot-password/${user._id}/${encodeURIComponent(
          linkVerificationtoken
        )}">link</a> to reset your password. The link expires in 10 mins.</p>`,
      };

      transporter.sendMail(maildata, (error, info) => {
        if (error) {
          console.log(error);
          return res.status(StatusCodes.BAD_REQUEST).json({ error: "Failed to send password reset email" });
        }
        console.log(info);
        return res.status(StatusCodes.OK).json({ message: "Check your email to reset your password" });
      });

      throw new UnauthenticatedError("Account is not verified, kindly check your mail for password reset.");
    }
  }

  if (user.userType === "contractor" && user.contractorAccountStatus !== "active") {
    throw new UnauthenticatedError("Your contractor account is not active. Please contact support.");
  }

  let token = user.createJWT();
  await User.findOneAndUpdate({ _id: user._id }, { token: token });
  token = user.token;

  res.status(StatusCodes.OK).json({ user, token });
};

export const logout = async (req, res) => {
  const { userId } = req.user;
  req.body.token = "";
  await User.findOneAndUpdate({ _id: userId }, req.body);
  res.status(StatusCodes.OK).json({ success: "Successfully logged out" });
};

export const signUp = async (req, res) => {
  try {
    // Prevent creation of tenant accounts through sign-up
    if (req.body.userType && req.body.userType === "tenant") {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "You are not allowed to create a tenant account through sign-up" });
    }

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "User with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    req.body.password = await bcrypt.hash(req.body.password, salt);

    const user = await User.create({ ...req.body });
    const maildata = {
      from: process.env.Email_User,
      to: user.email,
      subject: `${user.firstName}, verify your account`,
      html: `<p>Please use the following <a href="${domain}/auth/verify-account/${user.id}/${encodeURIComponent(
        linkVerificationtoken
      )}">link</a> to verify your account. The link expires in 10 mins.</p>`,
    };

    transporter.sendMail(maildata, (error, info) => {
      if (error) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Failed to send verification email" });
      }
      const token = user.createJWT();
      return res.status(StatusCodes.CREATED).json({
        user,
        token,
        message: "Check your email for account verification",
      });
    });
  } catch (error) {
    console.error("Error during sign-up:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

export const verifyAccount = async (req, res) => {
  const { token, userId } = req.params; // Correctly extract token and userId
  const secretKey = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secretKey); // Verify the token
    console.log("Token decoded successfully:", decoded);

    const user = await User.findOneAndUpdate({ _id: userId }, { verified: true }, { new: true, runValidators: true });

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
    }

    // Redirect to the desired route after successful verification
    res.redirect(`${FRONTEND_URL}/register/onboarding`);
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid or expired token" });
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

export const updateUser = async (req, res) => {
  const { userId } = req.user;

  // Find the user
  let user = await User.findOne({ _id: userId });
  if (!user) {
    throw new NotFoundError("User does not exist");
  }

  // Handle avatar upload if file is present
  if (req.body.avatar) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "Topspot/User/Avatar/",
            use_filename: true,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        req.avatar.stream.pipe(uploadStream);
      });

      req.body.avatar = result.url;
    } catch (error) {
      console.error(error);
      throw new BadRequestError({ "error uploading image on cloudinary": error });
    }
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
  const { email } = req.body;
  if (!email) {
    throw new BadRequestError("Email field is required");
  }
  const user = await User.findOne({ email: email });
  if (!user) {
    throw new NotFoundError("User does not exist");
  }

  const linkVerificationtoken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30m" });

  const maildata = {
    from: process.env.Email_User,
    to: user.email,
    subject: `${user.firstName}, you forgot your password`,
    html: `<p>Please use the following <a href="${FRONTEND_URL}/register?stage=create-password&id=${
      user.id
    }&token=${encodeURIComponent(
      linkVerificationtoken
    )}">link</a> to reset your password. The link expires in 30 minutes.</p>`,
  };

  transporter.sendMail(maildata, (error, info) => {
    if (error) {
      res.status(StatusCodes.BAD_REQUEST).send();
    }
    res.status(StatusCodes.OK).json({ success: "Check your email to change your password" });
  });
};

export const verifyForgotPasswordToken = async (req, res, next) => {
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

    // Update the user's password
    user.password = password;
    await user.save();

    return res.status(StatusCodes.OK).json({ user });
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
