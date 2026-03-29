import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getTrailsForHost,
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
  getPublicHomestaysByTrail,
  getPublicHomestayById,
} from "../controllers/homestayController.js";

const router = express.Router();

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

// Ensure upload directory exists
const homestaysDir = path.join(srcDir, "uploads", "homestays");
if (!fs.existsSync(homestaysDir)) fs.mkdirSync(homestaysDir, { recursive: true });

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
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowedTypes.test(file.mimetype);
  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp) are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max per file
});

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

// Get approved homestays for a specific trail (used on TrailDetail page)
router.get("/public/trail/:trailId", getPublicHomestaysByTrail);

// Get one approved homestay detail
router.get("/public/:id", getPublicHomestayById);

/* ─── ADMIN ROUTES (must be before :id params) ─── */

// Get all homestays for approval
router.get("/admin/all", verifyToken, requireAdmin, getAllHomestaysForAdmin);

// Approve or reject homestay
router.patch("/admin/:id/status", verifyToken, requireAdmin, updateHomestayStatus);

/* ─── HOST ROUTES ─── */

// Get trails list for dropdown
router.get("/trails", verifyToken, requireHost, getTrailsForHost);

// Get host's own homestays
router.get("/my", verifyToken, requireHost, getMyHomestays);

// Get single homestay
router.get("/:id", verifyToken, requireHost, getHomestayById);

// Create homestay
router.post("/", verifyToken, requireHost, upload.array("images", 5), createHomestay);

// Update homestay
router.put("/:id", verifyToken, requireHost, upload.array("images", 5), updateHomestay);

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
