import "dotenv/config";
import express from "express";
import "express-async-errors";
import mongoose from "mongoose";

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser"; // Add this line

import session from "express-session";
import passport from "passport";
import "./utils/passport.js";

//error handler
import errorHandlerMiddleware from "./middleware/error-handler.js";
import notFoundMiddleware from "./middleware/not-found.js";

//import route
import userRouter from "./routes/user.js";
import adminRouter from "./routes/admin.js";
import contractorRouter from "./routes/contractor.js";
import notificationRouter from "./routes/notification.js";
import paymentRouter from "./routes/payment.js";
import quoteRouter from "./routes/quote.js";
import serviceRouter from "./routes/service.js";

const app = express();
const port = process.env.PORT || 8000;

app.set("trust proxy", 1);

const whitelist = ["http://localhost:3000", "https://top-spot.vercel.app", "https://properties.topspothub.com"];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(helmet());
app.use(cookieParser()); // Use cookieParser middleware
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 2000, // Adjust the limit if needed
  })
);

app.get("/", (req, res) => {
  res.send(`Topspot Property Management API`);
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use("/contractor", contractorRouter);
app.use("/notification", notificationRouter);
app.use("/payment", paymentRouter);
app.use("/quote", quoteRouter);
app.use("/service", serviceRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    app.listen(port, () => console.log(`Server is running on port ${port}`));
  } catch (error) {
    console.log(error);
  }
};

start();
