import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getTrailsForHost,
  getHomestayAmenityCatalog,
  getMyHomestays,
  getHomestayById,
  createHomestay,
  updateHomestay,
  deleteHomestay,
  deleteHomestayImage,
  setHomestayPrimaryImage,
  toggleHomestayActive,
  updateHomestayAvailableRooms,
  getAllHomestaysForAdmin,
  updateHomestayStatus,
  getPublicHomestays,
  getPublicHomestaysByTrail,
  getPublicHomestayById,
} from "../controllers/homestayController.js";
import {
  getMyHostVerificationStatus,
  submitHostVerificationDocs,
  getAllHostVerificationsForAdmin,
  updateHostVerificationStatus,
} from "../controllers/hostVerificationController.js";

const router = express.Router();

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

// Ensure upload directory exists
const homestaysDir = path.join(srcDir, "uploads", "homestays");
if (!fs.existsSync(homestaysDir)) fs.mkdirSync(homestaysDir, { recursive: true });
const hostVerificationsDir = path.join(srcDir, "uploads", "host-verifications");
if (!fs.existsSync(hostVerificationsDir)) fs.mkdirSync(hostVerificationsDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, homestaysDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "homestay-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|webp/;
  const docTypes = /jpeg|jpg|png|webp|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "images") {
    const extValid = imageTypes.test(ext);
    const mimeValid = imageTypes.test(file.mimetype);
    if (!extValid || !mimeValid) {
      return cb(new Error("Only image files (jpg, png, webp) are allowed for homestay photos"), false);
    }
    return cb(null, true);
  }

  if (
    file.fieldname === "homestay_registration_certificate"
    || file.fieldname === "property_ownership_document"
  ) {
    const extValid = docTypes.test(ext);
    const mimeValid = docTypes.test(file.mimetype) || file.mimetype === "application/pdf";
    if (!extValid || !mimeValid) {
      return cb(new Error("Only image or PDF files are allowed for homestay documents"), false);
    }
    return cb(null, true);
  }

  if (file.fieldname === "citizenship_image") {
    const extValid = docTypes.test(ext);
    const mimeValid = docTypes.test(file.mimetype) || file.mimetype === "application/pdf";
    if (!extValid || !mimeValid) {
      return cb(new Error("Only image or PDF files are allowed for citizenship documents"), false);
    }
    return cb(null, true);
  }

  return cb(new Error(`Unexpected file field \"${file.fieldname}\"`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max per file
});

const homestayUploadFields = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "homestay_registration_certificate", maxCount: 1 },
  { name: "property_ownership_document", maxCount: 1 },
]);

const homestayUploadSafe = (req, res, next) => {
  homestayUploadFields(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size is 5 MB per file." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: `Unexpected file field \"${err.field}\" in homestay upload.` });
    }
    return res.status(400).json({ message: err.message || "Homestay upload error." });
  });
};

const hostVerificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, hostVerificationsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `host-${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const hostVerificationUpload = multer({
  storage: hostVerificationStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const hostVerificationUploadFields = hostVerificationUpload.fields([
  { name: "citizenship_image", maxCount: 1 },
]);

const hostVerificationUploadSafe = (req, res, next) => {
  hostVerificationUploadFields(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size is 5 MB per file." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: `Unexpected file field \"${err.field}\" in host verification upload.` });
    }
    return res.status(400).json({ message: err.message || "Host verification upload error." });
  });
};

// Host-only middleware
const requireHost = (req, res, next) => {
  if (req.user.user_type !== "host") {
    return res.status(403).json({ message: "Host access only" });
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

// Get all approved active homestays across trails
router.get("/public", getPublicHomestays);

// Get approved homestays for a specific trail (used on TrailDetail page)
router.get("/public/trail/:trailId", getPublicHomestaysByTrail);

// Get one approved homestay detail
router.get("/public/:id", getPublicHomestayById);

/* ─── ADMIN ROUTES (must be before :id params) ─── */

// Get all homestays for approval
router.get("/admin/all", verifyToken, requireAdmin, getAllHomestaysForAdmin);

// Approve or reject homestay
router.patch("/admin/:id/status", verifyToken, requireAdmin, updateHomestayStatus);

// Get all host verification submissions
router.get("/admin/hosts/all", verifyToken, requireAdmin, getAllHostVerificationsForAdmin);

// Approve or reject host verification
router.patch("/admin/hosts/:hostId/verification-status", verifyToken, requireAdmin, updateHostVerificationStatus);

/* ─── HOST ROUTES ─── */

// Get host verification status
router.get("/host/verification-status", verifyToken, requireHost, getMyHostVerificationStatus);

// Submit citizenship verification doc for host account
router.post("/host/verification-docs", verifyToken, requireHost, hostVerificationUploadSafe, submitHostVerificationDocs);

// Get trails list for dropdown
router.get("/trails", verifyToken, requireHost, getTrailsForHost);

// Get predefined amenity catalog for homestay listing form
router.get("/amenities", verifyToken, requireHost, getHomestayAmenityCatalog);

// Get host's own homestays
router.get("/my", verifyToken, requireHost, getMyHomestays);

// Get single homestay
router.get("/:id", verifyToken, requireHost, getHomestayById);

// Create homestay
router.post("/", verifyToken, requireHost, homestayUploadSafe, createHomestay);

// Update homestay
router.put("/:id", verifyToken, requireHost, homestayUploadSafe, updateHomestay);

// Delete homestay
router.delete("/:id", verifyToken, requireHost, deleteHomestay);

// Delete a specific image
router.delete("/:homestayId/images/:imageId", verifyToken, requireHost, deleteHomestayImage);

// Set one image as primary
router.patch("/:homestayId/images/:imageId/primary", verifyToken, requireHost, setHomestayPrimaryImage);

// Toggle active status
router.patch("/:id/toggle-active", verifyToken, requireHost, toggleHomestayActive);

// Update available rooms in real-time (manual host update)
router.patch("/:id/rooms", verifyToken, requireHost, updateHomestayAvailableRooms);

export default router;
