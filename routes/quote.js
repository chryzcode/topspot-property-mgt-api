import express from "express";
import { getServiceQuotes } from "../controllers/quote.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/service-quoutes/:serviceId").get(authenticateUser, getServiceQuotes);



export default router;
