import express from "express";
import {
  userServices,
  cancelService,
  createService,
  editService,
  completeService,
  searchServices,
  approveQuoteByOwner,
  ownerReplyQuote,
} from "../controllers/service.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/user-services").get(authenticateUser, userServices);
router.route("/cancel-service/:serviceId").post(authenticateUser, cancelService);
router.route("/create-service").post(authenticateUser, createService);
router.route("/edit-service/:serviceId").put(authenticateUser, editService);
router.route("/complete-service/:serviceId").post(authenticateUser, completeService);
router.route("/search-service").get(authenticateUser, searchServices);
router.route("/approve-quote/:quoteId").get(authenticateUser, approveQuoteByOwner);
router.route("/reject-quote/:quoteId").get(authenticateUser, ownerReplyQuote);

export default router;
