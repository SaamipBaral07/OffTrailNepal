import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  createHomestayBooking,
  getMyBookings,
  getHostBookings,
  cancelTouristBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

const requireTourist = (req, res, next) => {
  if (req.user.user_type !== "tourist") {
    return res.status(403).json({ message: "Tourist access only" });
  }
  next();
};

const requireHost = (req, res, next) => {
  if (req.user.user_type !== "host") {
    return res.status(403).json({ message: "Host access only" });
  }
  next();
};

router.post("/", verifyToken, requireTourist, createHomestayBooking);
router.get("/my", verifyToken, requireTourist, getMyBookings);
router.patch("/:bookingId/cancel", verifyToken, requireTourist, cancelTouristBooking);

router.get("/host", verifyToken, requireHost, getHostBookings);

export default router;
