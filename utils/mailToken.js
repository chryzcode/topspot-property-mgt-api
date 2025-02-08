import "dotenv/config";
import jwt from "jsonwebtoken";

export const sendEmail = async (to, subject, html) => {
  try {
    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
      },
      body: JSON.stringify({
        from: {
          email: process.env.EMAIL_ADDRESS, // Change this to your verified sender email
          name: "TopSpot Property Management",
        },
        to: [{ email: to }],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};


export const generateToken = uniqueID => {
  const expiry = "20m";
  const secretKey = process.env.JWT_SECRET;
  return jwt.sign({ id: uniqueID }, secretKey, { expiresIn: expiry });
};



