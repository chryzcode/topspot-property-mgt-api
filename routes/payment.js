import express from "express";
import { cancelPayment, successfulPayment, makePayment } from "../controllers/payment.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/:serviceId/cancel-payment/:userId").get(cancelPayment);
router.route("/:serviceId/successful-payment/:userId").post(successfulPayment);
router.route("/make-payment/:serviceId").post(authenticateUser, makePayment);

export default router;
