import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },

    description: {
      type: String,
      required: [true, "Please provide description"],
    },
    currency: {
      type: String,
      enum: ["php"],
      default: "php",
      required: [true, "Please provide currency, ex. php"],
    },
    estimatedCost: {
      type: Number,
      required: [true, "Please provide amount"],
    },

    approve: {
      type: String,
      enum: ["pending", "approved", "cancelled"],
      default: "pending",
      required: [true, "Please provide approve status, ex. approved"],
    },

    availableFromDate: {
      type: Date,
    },
    availableToDate: {
      type: Date,
    },
    availableFromTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Please provide a valid time in HH:mm format"],
    },
    availableToTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Please provide a valid time in HH:mm format"],
    },
  },

  {
    timestamps: true,
  }
);

const Quote = mongoose.model("Quote", quoteSchema);

export { Quote };
