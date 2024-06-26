import express from "express";
import {
  getTenantsAndHouseOwners,
  upgradeToHomeOwner,
  downgradeToTenant,
  getAllServices,
  getServiceQuotes,
  filterServicesMonthly,
} from "../controllers/admin.js";

import authenticateUser from "../middleware/authentication.js";
import admin from "../middleware/admin.js";

const router = express.Router();

router.route("/get-tenants-and-houseowners").get(authenticateUser, admin, getTenantsAndHouseOwners);
router.route("/upgrade-to-homeowner/:userId").post(authenticateUser, admin, upgradeToHomeOwner);
router.route("/downgrade-to-tenant/:userId").post(authenticateUser, admin, downgradeToTenant);
router.route("/get-all-services").get(authenticateUser, admin, getAllServices);
router.route("/get-service-quotes/:serviceId").get(authenticateUser, admin, getServiceQuotes);
router.route("/filter-services-monthly").get(authenticateUser, admin, filterServicesMonthly);


export default router;
