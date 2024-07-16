import express from "express";
import {
  contractorServices,
  completedServices,
  allContractorServices,
  contractorApproveQuote,
  contractorReplyQuote,
} from "../controllers/contractor.js";

import authenticateUser from "../middleware/authentication.js";
import authenticateContractor from "../middleware/contractor.js"

const router = express.Router();

router.route("/contractor-services").get(authenticateUser, authenticateContractor, contractorServices);
router.route("/completed-services").get(authenticateUser, authenticateContractor, completedServices);
router.route("/all-contractor-services").get(authenticateUser, authenticateContractor, allContractorServices);
router.route("/approve-quote/:quoteId").post(authenticateUser, authenticateContractor, contractorApproveQuote);
router.route("/reply-quote/:quoteId").post(authenticateUser, authenticateContractor, contractorReplyQuote);

export default router;
