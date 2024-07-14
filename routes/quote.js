import express from "express";
import { getServiceQuotes, createQuote } from "../controllers/quote.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/service-quoutes/:serviceId").get(authenticateUser, getServiceQuotes);
router.route("/create-quote/:serviceId").post(authenticateUser, createQuote);



export default router;
