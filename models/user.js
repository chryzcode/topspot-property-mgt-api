import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const allowedCategories = ["plumbing", "painting", "furniture assembly", "electrical work", "room cleaning", "other"];

const mediaSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, "Please provide url"],
  },
});

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
    username: {
      type: String,
      required: true,
      unique: true,
      match: [/^\S+$/, "Please provide a valid username"],
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
    },

    country: {
      type: String,
    },

    state: {
      type: String,
    },

    postalCode: {
      type: String,
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

    yearsOfExperience: {
      type: Number,
      required: [true, "Please provide years of experience"],
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
  },

  {
    timestamps: true,
  }
);

userSchema.pre("save", async function () {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

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

const User = mongoose.model("User", userSchema);
const Media = mongoose.model("Media", mediaSchema);

export { User, allowedCategories, Media };
