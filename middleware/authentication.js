import jwt from "jsonwebtoken";
import { UnauthenticatedError } from "../errors/index.js";
import { User } from "../models/user.js";

export default async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  const token = authHeader.split(" ")[1];
  let user;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user with the provided token and verified status
    if (payload.userType === "tenant" || payload.userType === "homeowner") {
       user = await User.findOne({ _id: payload.userId, token: token, verified: true, adminVerified: true });
    } else {
       user = await User.findOne({ _id: payload.userId, token: token, verified: true });
    }

    if (!user) {
      throw new UnauthenticatedError("Authentication invalid");
    }

    // Attach the user to the job routes
    req.user = { userId: user._id, firstName: user.firstName, lastName: user.lastName };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    throw new UnauthenticatedError("Authentication invalid");
  }
};