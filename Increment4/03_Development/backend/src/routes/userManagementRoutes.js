import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { captureAdminActivity } from "../middleware/adminActivityMiddleware.js";
import {
  getAdminUserDirectory,
  updateUserAccountLifecycle,
} from "../controllers/userManagementController.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  return captureAdminActivity(req, res, next);
};

router.get("/admin/directory", verifyToken, requireAdmin, getAdminUserDirectory);
router.patch("/admin/:role/:userId/lifecycle", verifyToken, requireAdmin, updateUserAccountLifecycle);

export default router;
