import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getTrailsForGuide,
  addGuideToTrail,
  getMyTrails,
  updateGuideTrail,
  removeGuideFromTrail,
  toggleGuideTrailActive,
  getGuidesByTrail,
  getAllGuidesAdmin,
} from "../controllers/guideController.js";
import { getMyAvailability, toggleAvailability } from "../controllers/guideAvailabilityController.js";
import { getMyReviews } from "../controllers/guideReviewController.js";
import {
  createService,
  getMyServices,
  updateService,
  deleteService,
  toggleServiceActive,
} from "../controllers/guideServiceController.js";

const router = express.Router();

// Guide-only middleware
const requireGuide = (req, res, next) => {
  if (req.user.user_type !== "guide") {
    return res.status(403).json({ message: "Guide access only" });
  }
  next();
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/* ─── PUBLIC ROUTES (no auth) ─── */

// Get active guides for a specific trail
router.get("/public/trail/:trailId", getGuidesByTrail);

/* ─── GUIDE TRAIL ROUTES ─── */

// Get trails list for dropdown
router.get("/trails-list", verifyToken, requireGuide, getTrailsForGuide);

// Get guide's own trail assignments
router.get("/my-trails", verifyToken, requireGuide, getMyTrails);

// Add guide to a trail
router.post("/trails", verifyToken, requireGuide, addGuideToTrail);

// Update guide trail info
router.put("/trails/:id", verifyToken, requireGuide, updateGuideTrail);

// Delete guide from trail
router.delete("/trails/:id", verifyToken, requireGuide, removeGuideFromTrail);

// Toggle active status
router.patch("/trails/:id/toggle-active", verifyToken, requireGuide, toggleGuideTrailActive);

/* ─── GUIDE SERVICE ROUTES ─── */

// Get guide's own services
router.get("/services", verifyToken, requireGuide, getMyServices);

// Create a new service
router.post("/services", verifyToken, requireGuide, createService);

// Update a service
router.put("/services/:id", verifyToken, requireGuide, updateService);

// Delete a service
router.delete("/services/:id", verifyToken, requireGuide, deleteService);

// Toggle service active status
router.patch("/services/:id/toggle-active", verifyToken, requireGuide, toggleServiceActive);

/* ─── GUIDE AVAILABILITY ROUTES ─── */
router.get("/availability", verifyToken, requireGuide, getMyAvailability);
router.post("/availability", verifyToken, requireGuide, toggleAvailability);

/* ─── GUIDE REVIEWS ROUTES ─── */
router.get("/reviews", verifyToken, requireGuide, getMyReviews);

/* ─── ADMIN ROUTES ─── */
router.get("/admin/all", verifyToken, requireAdmin, getAllGuidesAdmin);

export default router;

