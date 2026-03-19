import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getAllTrails,
  getTrailById,
  createTrail,
  updateTrail,
  deleteTrail,
  getPublicTrails,
  getPublicTrailById
} from "../controllers/trailController.js";

const router = express.Router();

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

// Ensure upload directories exist
const gpxDir = path.join(srcDir, "uploads", "gpx");
const trailsDir = path.join(srcDir, "uploads", "trails");
if (!fs.existsSync(gpxDir)) fs.mkdirSync(gpxDir, { recursive: true });
if (!fs.existsSync(trailsDir)) fs.mkdirSync(trailsDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "gpx_file") {
      cb(null, gpxDir);
    } else if (file.fieldname === "images" || file.fieldname === "replacement_images") {
      cb(null, trailsDir);
    } else {
      cb(new Error(`Unexpected file field: ${file.fieldname}`));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "gpx_file") {
    // Accept .gpx files
    if (file.originalname.toLowerCase().endsWith(".gpx")) {
      cb(null, true);
    } else {
      cb(new Error("Only .gpx files are allowed"), false);
    }
  } else if (file.fieldname === "images" || file.fieldname === "replacement_images") {
    // Accept image files
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeValid = allowedTypes.test(file.mimetype);
    if (extValid && mimeValid) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpg, png, webp) are allowed"), false);
    }
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

const uploadFields = upload.fields([
  { name: "gpx_file", maxCount: 1 },
  { name: "images", maxCount: 5 },
  { name: "replacement_images", maxCount: 10 }
]);

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// Multer error handler — wraps uploadFields so multer errors return JSON
const uploadFieldsSafe = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size is 10 MB per file." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: `Too many files for field "${err.field}". Max allowed: images×5, gpx_file×1.` });
    }
    return res.status(400).json({ message: err.message || "File upload error." });
  });
};

// Public routes (no auth required)
router.get("/public", getPublicTrails);
router.get("/public/:id", getPublicTrailById);

// Admin routes
router.get("/", verifyToken, requireAdmin, getAllTrails);
router.get("/:id", verifyToken, requireAdmin, getTrailById);
router.post("/", verifyToken, requireAdmin, uploadFieldsSafe, createTrail);
router.put("/:id", verifyToken, requireAdmin, uploadFieldsSafe, updateTrail);
router.delete("/:id", verifyToken, requireAdmin, deleteTrail);

export default router;
