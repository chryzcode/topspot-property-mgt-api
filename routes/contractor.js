import express from "express";
import {
  contractorServices,
  completedServices,
  allContractorServices,
  contractorApproveQuote,
  contractorReplyQuote,
} from "../controllers/contractor.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/contractor-services").get(authenticateUser, contractorServices);
router.route("/completed-services").get(authenticateUser, completedServices);
router.route("/all-contractor-services").post(authenticateUser, allContractorServices);
router.route("/approve-quote/:quoteId").post(authenticateUser, contractorApproveQuote);
router.route("/reply-quote/:quoteId").post(authenticateUser, contractorReplyQuote);

export default router;
