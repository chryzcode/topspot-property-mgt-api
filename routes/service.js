import express from "express";
import {
  userServices,
  cancelService,
  createService,
  editService,
  completeService,
  searchServices,
  approveQuoteByOwner,
  ownerDisapproveQuoye,
} from "../controllers/service.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/user-services").get(authenticateUser, userServices);
router.route("/cancel-service/:serviceId").post(authenticateUser, cancelService);
router.route("/create-service").post(authenticateUser, createService);
router.route("/edit-service/:serviceId").put(authenticateUser, editService);
router.route("/complete-service/:serviceId").post(authenticateUser, completeService);
router.route("/search-service").get(authenticateUser, searchServices);
router.route("/approve-quote/:quoteId").post(authenticateUser, approveQuoteByOwner);
router.route("/disapprove-quote/:quoteId").post(authenticateUser, ownerDisapproveQuoye);

export default router;
