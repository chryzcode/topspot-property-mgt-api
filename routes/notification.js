import express from "express";
import { getAllNotifications, } from "../controllers/notification.js";

import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.route("/all-notification").get(authenticateUser, getAllNotifications);

export default router;
