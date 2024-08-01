import express from "express";
import { cancelPayment, successfulPayment, makePayment } from "../controllers/payment.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/cancel-payment/:serviceId").get(cancelPayment);
router.route("/successful-payment/:serviceId").post(successfulPayment);
router.route("/make-payment/:serviceId").post(authenticateUser, makePayment);

export default router;
