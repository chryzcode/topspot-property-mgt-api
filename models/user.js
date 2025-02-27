import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const allowedCategories = ["plumbing", "painting", "furniture assembly", "electrical work", "room cleaning", "other"];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide first name"],
    },
    lastName: {
      type: String,
      required: [true, "Please provide last name"],
    },
    avatar: {
      type: String,
    },

    email: {
      required: true,
      type: String,
      unique: true,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please provide a valid email",
      ],
    },

    recoveryEmail: {
      type: String,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please provide a valid email",
      ],
    },

    userType: {
      type: String,
      enum: ["houseOwner", "contractor", "tenant", "admin"],
      required: [true, "Please provide user type"],
    },

    country: {
      type: String,
    },

    state: {
      type: String,
    },

    city: {
      type: String,
    },

    postalCode: {
      type: String,
    },

    serviceCountry: {
      type: String,
    },

    serviceState: {
      type: String,
    },

    servicePostalCode: {
      type: String,
    },

    addressLine1: {
      type: String,
      required: [true, "Please provide address line 1"],
    },

    addressLine2: {
      type: String,
    },

    categories: {
      type: [
        {
          type: String,
          enum: allowedCategories, // Only allow specific categories
        },
      ],
    },

    yearsOfExperience: {
      type: Number,
    },

    password: {
      type: String,
      required: [true, "Please provide password"],
      minlength: 5,
    },
    token: {
      type: String,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    
    adminVerified: {
      type: Boolean,
      default: false,
    },

    contractorAccountStatus: {
      type: String,
      enum: ["pending", "active", "disabled"],
      default: "pending",
    },

    contactNumber: {
      type: Number,
    },
    secondaryContactNumber: {
      type: Number,
    },
    leaseStartDate: {
      type: String,
    },
    leaseEndDate: {
      type: String,
    },
    leasePayment: {
      type: String,
    },

    tenantRoomNumber: {
      type: String,
    },
    lodgeName: {
      type: String,
    },
    tenantId: {
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

userSchema.methods.createJWT = function () {
  const token = jwt.sign(
    { userId: this._id, firstName: this.firstName, lastName: this.lastName },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
  this.token = token;
  return token;
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password; // Exclude the password field
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export { User, allowedCategories };
