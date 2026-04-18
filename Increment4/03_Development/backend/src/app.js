import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import trailRoutes from "./routes/trailRoutes.js";
import homestayRoutes from "./routes/homestayRoutes.js";
import guideRoutes from "./routes/guideRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import guideBookingRoutes from "./routes/guideBookingRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import tripPlannerRoutes from "./routes/tripPlannerRoutes.js";
import aiChatRoutes from "./routes/aiChatRoutes.js";
import userManagementRoutes from "./routes/userManagementRoutes.js";
import { csrfProtection } from "./middleware/csrfMiddleware.js";
import { refreshTokenLimiter, authLimiter } from "./middleware/rateLimitMiddleware.js";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Rate limiting
// Refresh token endpoint gets stricter limits
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/refresh-token", refreshTokenLimiter);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply CSRF protection to all non-safe API methods.
app.use("/api", csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/trails", trailRoutes);
app.use("/api/homestays", homestayRoutes);
app.use("/api/guides", guideRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/guide-bookings", guideBookingRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/trip-planner", tripPlannerRoutes);
app.use("/api/ai-chat", aiChatRoutes);
app.use("/api/users", userManagementRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

export default app;
