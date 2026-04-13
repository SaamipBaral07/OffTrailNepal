import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  logout,
  getCsrfToken,
  getTouristProfile,
  updateTouristProfile,
  updateTouristPassword,
  getHostProfile,
  updateHostProfile,
  updateHostBankDetails,
  getGuideProfile,
  getAdminProfile,
  updateGuideProfile,
  updateGuideBankDetails,
  updateProfilePhoto,
} from "../controllers/authController.js";
import { getAdminActivityLogs } from "../controllers/adminActivityController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getMe } from "../controllers/authController.js";
import { verifyRefreshToken } from "../middleware/refreshTokenMiddleware.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");
const profilesDir = path.join(srcDir, "uploads", "profiles");

if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const profileFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowedTypes.test(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp) are allowed"), false);
  }
};

const profileUpload = multer({
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  return next();
};

// CSRF token endpoint (must be GET, no CSRF check needed)
router.get("/csrf-token", getCsrfToken);

router.post("/register", profileUpload.single("profile_photo"), register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh-token", verifyRefreshToken, refreshTokenHandler);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);
router.get("/tourist/profile", verifyToken, getTouristProfile);
router.patch("/tourist/profile", verifyToken, updateTouristProfile);
router.patch("/tourist/password", verifyToken, updateTouristPassword);
router.get("/host/profile", verifyToken, getHostProfile);
router.patch("/host/profile", verifyToken, updateHostProfile);
router.patch("/host/bank-details", verifyToken, updateHostBankDetails);
router.get("/guide/profile", verifyToken, getGuideProfile);
router.get("/admin/profile", verifyToken, getAdminProfile);
router.get("/admin/activity-logs", verifyToken, requireAdmin, getAdminActivityLogs);
router.patch("/guide/profile", verifyToken, updateGuideProfile);
router.patch("/guide/bank-details", verifyToken, updateGuideBankDetails);
router.patch("/profile-photo", verifyToken, profileUpload.single("profile_photo"), updateProfilePhoto);

export default router;
