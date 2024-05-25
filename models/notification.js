import mongoose from "mongoose";
import { Service } from "./service";

const notificationSchema = mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    message: {
      type: String,
      required: [true, "Please provide message"],
    },

    service: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };
