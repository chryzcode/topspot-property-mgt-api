import mongoose from "mongoose";
import { allowedCategories } from "./user";

const quoteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide first name"],
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
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

    estimatedCost: {
      type: Number,
      required: [true, "Please provide amount"],
    },

    approve: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  }
);

const Quote = mongoose.model("Quote", quoteSchema);

export { Quote };
