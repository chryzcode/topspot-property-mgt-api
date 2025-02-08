import "dotenv/config";
import jwt from "jsonwebtoken";

export const sendEmail = async (to, subject, html) => {
  try {
    // Ensure `to` is always an array of objects with email properties
    const recipients = Array.isArray(to) ? to : [{ email: to }];

    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
      },
      body: JSON.stringify({
        from: {
          email: process.env.EMAIL_ADDRESS, // Must be a verified sender in Mailtrap
          name: "TopSpot Property Management",
        },
        to: recipients,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // console.error("Failed Mailtrap Response:", data);
      throw new Error(`Failed to send email: ${data.errors?.join(", ") || response.statusText}`);
    }

    // console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending email:", error.message);
    // You can also add more advanced error handling here (e.g., retry mechanism)
  }
};



export const generateToken = uniqueID => {
  const expiry = "20m";
  const secretKey = process.env.JWT_SECRET;
  return jwt.sign({ id: uniqueID }, secretKey, { expiresIn: expiry });
};



