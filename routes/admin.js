import express from "express";
import {
  getTenantsAndHouseOwners,
  upgradeToHomeOwner,
  downgradeToTenant,
  getAllServices,
  getServiceQuotes,
  filterServicesMonthly,
  assignContractor,
  adminGetAllQuotes,
  adminVerifyContractor,
  allContractors,
  deleteContractorAccount,
  allUsers,
  createTenantAccount,
  getUserProfile,
  adminVerifyTenant,
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
router.route("/assign-contractor/:serviceId").post(authenticateUser, admin, assignContractor);
router.route("/verify-contractor/:contractorId").post(authenticateUser, admin, adminVerifyContractor);
router.route("/get-all-quotes").get(authenticateUser, admin, adminGetAllQuotes);
router.route("/all-contractors").get(authenticateUser, admin, allContractors);
router.route("/delete-contractor/:contractorId").delete(authenticateUser, admin, deleteContractorAccount);
router.route("/all-users").get(authenticateUser, admin, allUsers);
router.route("/create-tenant").post(authenticateUser, admin, createTenantAccount);
router.route("/profile/:userId").get(authenticateUser, admin, getUserProfile);
router.route("/verify-tenant/:tenantId").post(authenticateUser, admin, adminVerifyTenant);
export default router;
