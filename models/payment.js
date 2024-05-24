import mongoose from "mongoose";

const paymentSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    paid: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export { Payment };
