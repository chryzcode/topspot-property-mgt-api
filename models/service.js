import mongoose from "mongoose";
import { allowedCategories } from "./user.js";

const serviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    location: {
      type: String,
    },

    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Please provide first name"],
    },

    categories: {
      type: [
        {
          type: String,
          enum: allowedCategories, // Only allow specific categories
        },
      ],
      required: [true, "Please provide category"],
    },

    description: {
      type: String,
      required: [true, "Please provide description"],
    },
    currency: {
      type: String,
      enum: ["php"],
    },
    amount: {
      type: Number,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    availableFromDate: {
      type: Date,
      required: [true, '"Please provide available from date'],
    },
    availableToDate: {
      type: Date,
      required: [true, '"Please provide available to date'],
    },
    availableFromTime: {
      type: String,
      required: [true, "Please provide available from time"],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Please provide a valid time in HH:mm format"],
    },
    availableToTime: {
      type: String,
      required: [true, "Please provide available to time"],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Please provide a valid time in HH:mm format"],
    },
    status: {
      type: String,
      enum: ["ongoing", "pending", "completed", "cancelled"],
      default: "pending",
      required: [true, "Please provide status, ex. ongoing"],
    },
  },

  {
    timestamps: true,
  }
);

const Service = mongoose.model("Service", serviceSchema);

export { Service };
