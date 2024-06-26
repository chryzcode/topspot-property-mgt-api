import { StatusCodes } from "http-status-codes";
import { Notification } from "../models/notification.js";


export const getAllNotifications = async (req, res) => {
  const { userId } = req.user;
  const notifications = await Notification.find({ toUser: userId })
    .populate("toUser", "firstName lastName avatar username userType _id")
    .populate("fromUser", "firstName lastName avatar username userType _id");
  res.status(StatusCodes.CREATED).json({ notifications });
};
