import express from "express";
import { getServiceQuotes, createQuote, approveQuote, declineQuote } from "../controllers/quote.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/service-quoutes/:serviceId").get(authenticateUser, getServiceQuotes);
router.route("/create-quote/:serviceId").post(authenticateUser, createQuote);
router.route("/approve-quote/:quoteId").post(authenticateUser, approveQuote);
router.route("/decline-quote/:quoteId").post(authenticateUser, declineQuote);


export default router;
