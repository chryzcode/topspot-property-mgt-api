import mongoose from "mongoose";
import { allowedCategories } from "./user";

const serviceSchema = new mongoose.Schema(
  {
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
      enum: ["usd"],
      default: "usd",
      required: [true, "Please provide currency, ex. usd"],
    },
    amount: {
      type: Number,
      required: [true, "Please provide amount"],
    },
    availableFromDate: {
      type: Date,
      required: [true, '"Please provide available from date'],
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
    media: ["Media"],
  },

  {
    timestamps: true,
  }
);

const Service = mongoose.model("Service", serviceSchema);

export { Service };
