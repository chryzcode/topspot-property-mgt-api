import express from "express";
import { getTenantsAndHouseOwners, } from "../controllers/admin.js";

import authenticateUser from "../middleware/authentication.js";
import admin from "../middleware/admin.js";

const router = express.Router();

router.route("/get-tenants-and-houseowners").get(authenticateUser, admin, getTenantsAndHouseOwners);

export default router;
