import nodemailer from "nodemailer";
import "dotenv/config";
import jwt from "jsonwebtoken";

export const transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587, // or 465 for SSL, but 587 is generally used for TLS
  auth: {
    user: process.env.Email_User, // Your Mailtrap SMTP username
    pass: process.env.Email_Password, // Your Mailtrap SMTP password
  },
  secure: false, // Set to true if using port 465
});


export const generateToken = uniqueID => {
  const expiry = "20m";
  const secretKey = process.env.JWT_SECRET;
  return jwt.sign({ id: uniqueID }, secretKey, { expiresIn: expiry });
};



