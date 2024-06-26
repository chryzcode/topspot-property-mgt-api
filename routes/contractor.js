import express from "express";
import { contractorServices, completedServices, allContractorServices } from "../controllers/contractor.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/contractor-services").get(authenticateUser, contractorServices);
router.route("/completed-services").get(authenticateUser, completedServices);
router.route("all-contractor-services").post(authenticateUser, allContractorServices);

export default router;
