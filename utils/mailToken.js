import nodemailer from "nodemailer";
import "dotenv/config";
import jwt from "jsonwebtoken";

export const transporter = nodemailer.createTransport({
  port: 465, // true for 465, false for other ports
  host: "smtp.gmail.com",
  auth: {
    user: process.env.Email_User,
    pass: process.env.Email_Password,
  },
  secure: true,
});



export const generateToken = (uniqueID) => {
  const expiry = "10m";
  const secret_key = process.env.JWT_SECRET;
  return jwt.sign({ id: uniqueID }, secret_key, { expiresIn: expiry });
};




