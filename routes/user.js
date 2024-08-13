import express from "express";
import {
  signIn,
  signUp,
  getUser,
  updateUser,
  deleteUser,
  logout,
  sendForgotPasswordLink,
  verifyForgotPasswordToken,
  verifyAccount,
  currentUser,
  chooseUserType,
  getUserQuotes,
  updateUserAvatar,
} from "../controllers/user.js";

import authenticateUser from "../middleware/authentication.js";
import passport from "passport";
import { StatusCodes } from "http-status-codes";
import { multerUpload } from "../utils/cloudinaryConfig.js";

const router = express.Router();

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
  })
);

// Call back route
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    access_type: "offline",
    scope: ["email", "profile"],
  }),
  (req, res) => {
    if (!req.user) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: "Authentication failed" });
    }
    res
      .status(StatusCodes.OK)
      .json({ user: { firstName: req.user.firstName, lastName: req.user.lastName }, token: req.user.token });
  }
);

router.route("/auth/signup").post(signUp);
router.route("/auth/signin").post(signIn);
router.route("/usertype/:userId").post(chooseUserType);
router.route("/profile/:userId").get(getUser);
router.route("/current-user").get(authenticateUser, currentUser);
router.route("/auth/logout").post(authenticateUser, logout);
router.route("/update").put(authenticateUser, updateUser);
router.route("/update-avatar").put(authenticateUser, multerUpload.single("avatar"), updateUserAvatar);
router.route("/delete").delete(authenticateUser, deleteUser);
router.route("/get-all-user-quotes").get(authenticateUser, getUserQuotes);
router.route("/send-forgot-password-link").post(sendForgotPasswordLink);
router.route("/auth/forgot-password").post(verifyForgotPasswordToken);
router.route("/auth/verify-account").get(verifyAccount);

export default router;
