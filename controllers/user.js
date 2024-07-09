import { User } from "../models/user.js";
import { StatusCodes } from "http-status-codes";
import { transporter, generateToken } from "../utils/mailToken.js";
import { BadRequestError, UnauthenticatedError, NotFoundError } from "../errors/index.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import bcrypt from "bcryptjs";
import multer from "multer";

cloudinary.v2.config(process.env.CLOUDINARY_URL);

// Set up Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });


const uniqueID = uuidv4();
const domain = process.env.DOMAIN || "http://localhost:8000";
const FRONTEND_URL = process.env.FRONTEND_URL

const linkVerificationtoken = generateToken(uniqueID);

export const logout = async (req, res) => {
  const { userId } = req.user;
  req.body.token = "";
  await User.findOneAndUpdate({ _id: userId }, req.body);
  res.status(StatusCodes.OK).json({ success: "Successfully logged out" });
};

export const signUp = async (req, res) => {
  const user = await User.create({ ...req.body });
  const maildata = {
    from: process.env.Email_User,
    to: user.email,
    subject: `${user.firstName} verify your account`,
    html: `<p>Please use the following <a href="${domain}/auth/verify-account/${
      user.id
    }/${encodeURIComponent(
      linkVerificationtoken
    )}">link</a> to verify your account. Link expires in 10 mins.</p>`,
  };
  transporter.sendMail(maildata, (error, info) => {
    if (error) {
      res.status(StatusCodes.BAD_REQUEST).send();
    }
    res.status(StatusCodes.OK).send();
  });
  const token = user.createJWT();
  res.status(StatusCodes.CREATED).json({
    user,
    token,
    msg: "check your mail for account verification",
  });
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
  let user = await User.findOne({ _id: userId });

  if (!user) {
    throw new NotFoundError("User does not exist");
  }

  if (req.file) {
    try {
      const result = await cloudinary.v2.uploader.upload_stream(
        {
          folder: "Topspot/User/Avatar/",
          use_filename: true,
        },
        (error, result) => {
          if (error) {
            console.error(error);
            throw new BadRequestError({ "error uploading image on cloudinary": error });
          } else {
            req.body.avatar = result.url;
            updateUserDetails(req, res, userId);
          }
        }
      );

      req.file.stream.pipe(result);
    } catch (error) {
      console.error(error);
      throw new BadRequestError({ "error uploading image on cloudinary": error });
    }
  } else {
    updateUserDetails(req, res, userId);
  }
};

const updateUserDetails = async (req, res, userId) => {
  const user = await User.findOneAndUpdate({ _id: userId }, req.body, {
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
    throw new NotFoundError("User does not exists");
  }
  const maildata = {
    from: process.env.Email_User,
    to: user.email,
    subject: `${user.firstName} you forgot your password`,
    html: `<p>Please use the following <a href="${domain}/verify/forgot-password/${
      user.id
    }/${encodeURIComponent(linkVerificationtoken)}">link</a> for verification. Link expires in 30 mins.</p>`,
  };
  transporter.sendMail(maildata, (error, info) => {
    if (error) {
      res.status(StatusCodes.BAD_REQUEST).send();
    }
    res.status(StatusCodes.OK).json({ success: "Check you email to change your password" });
  });
};

export const verifyForgotPasswordToken = async (req, res) => {
  const token = req.params.token;
  const userId = req.params.userId;
  const secretKey = process.env.JWT_SECRET;
  var { password } = req.body;
  try {
    jwt.verify(token, secretKey);
    const salt = await bcrypt.genSalt(10);
    password = await bcrypt.hash(password, salt);
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { password: password, token: token },
      { runValidators: true, new: true }
    );

    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid or expired token" });
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
