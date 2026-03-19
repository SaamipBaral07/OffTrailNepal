import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  logout,
  getCsrfToken
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getMe } from "../controllers/authController.js";
import { verifyRefreshToken } from "../middleware/refreshTokenMiddleware.js";

const router = express.Router();

// CSRF token endpoint (must be GET, no CSRF check needed)
router.get("/csrf-token", getCsrfToken);

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh-token", verifyRefreshToken, refreshTokenHandler);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);

export default router;
