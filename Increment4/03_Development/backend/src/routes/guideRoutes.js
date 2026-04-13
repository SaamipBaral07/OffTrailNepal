import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import { captureAdminActivity } from "../middleware/adminActivityMiddleware.js";
import {
  getTrailsForGuide,
  addGuideToTrail,
  getMyTrails,
  updateGuideTrail,
  removeGuideFromTrail,
  toggleGuideTrailActive,
  getGuidesByTrail,
  getPublicGuides,
  getAllGuidesAdmin,
} from "../controllers/guideController.js";
import {
  getMyGuideVerificationStatus,
  submitGuideVerificationDocs,
  updateGuideVerificationStatus,
} from "../controllers/guideVerificationController.js";
import { getMyAvailability, toggleAvailability } from "../controllers/guideAvailabilityController.js";
import { getMyReviews } from "../controllers/guideReviewController.js";
import {
  createService,
  getMyServices,
  updateService,
  deleteService,
  toggleServiceActive,
  getAdminGuideServices,
  updateGuideServiceApprovalStatus,
  getPublicServicesByGuide,
} from "../controllers/guideServiceController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");
const verificationDir = path.join(srcDir, "uploads", "guide-verifications");

if (!fs.existsSync(verificationDir)) {
  fs.mkdirSync(verificationDir, { recursive: true });
}

const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, verificationDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const verificationFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowedTypes.test(file.mimetype);
  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp) are allowed"), false);
  }
};

const verificationUpload = multer({
  storage: verificationStorage,
  fileFilter: verificationFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const verificationUploadFields = verificationUpload.fields([
  { name: "citizenship_image", maxCount: 1 },
  { name: "guide_license_image", maxCount: 1 },
]);

const verificationUploadSafe = (req, res, next) => {
  verificationUploadFields(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size is 5 MB per file." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: `Unexpected file field \"${err.field}\" in verification upload.` });
    }
    return res.status(400).json({ message: err.message || "Verification document upload error." });
  });
};

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
  return captureAdminActivity(req, res, next);
};

/* ─── PUBLIC ROUTES (no auth) ─── */

// Get active guides for a specific trail
router.get("/public", getPublicGuides);
router.get("/public/trail/:trailId", getGuidesByTrail);
router.get("/public/:guideId/services", getPublicServicesByGuide);

/* ─── GUIDE TRAIL ROUTES ─── */

// Get verification status for current guide
router.get("/verification-status", verifyToken, requireGuide, getMyGuideVerificationStatus);

// Submit or resubmit verification docs
router.post("/verification-docs", verifyToken, requireGuide, verificationUploadSafe, submitGuideVerificationDocs);

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
router.patch("/admin/:guideId/verification-status", verifyToken, requireAdmin, updateGuideVerificationStatus);
router.get("/admin/services", verifyToken, requireAdmin, getAdminGuideServices);
router.patch("/admin/services/:id/approval-status", verifyToken, requireAdmin, updateGuideServiceApprovalStatus);

export default router;

