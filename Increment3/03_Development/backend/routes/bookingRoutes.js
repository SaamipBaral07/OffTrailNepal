import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  createHomestayBooking,
  initiateEsewaPaymentForBooking,
  initiateStripePaymentForBooking,
  verifyEsewaPaymentAndCreateBooking,
  handleEsewaSuccessCallback,
  handleEsewaFailureCallback,
  handleStripeSuccessCallback,
  handleStripeCancelCallback,
  getPaymentSessionStatus,
  getAdminBookingPayments,
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

const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

router.get("/payment/esewa/success", handleEsewaSuccessCallback);
router.get("/payment/esewa/failure", handleEsewaFailureCallback);
router.post("/payment/esewa/success", handleEsewaSuccessCallback);
router.post("/payment/esewa/failure", handleEsewaFailureCallback);
router.get("/payment/stripe/success", handleStripeSuccessCallback);
router.get("/payment/stripe/cancel", handleStripeCancelCallback);

router.post("/", verifyToken, requireTourist, createHomestayBooking);
router.post("/payment/initiate", verifyToken, requireTourist, initiateEsewaPaymentForBooking);
router.post("/payment/stripe/initiate", verifyToken, requireTourist, initiateStripePaymentForBooking);
router.post("/stripe/initiate", verifyToken, requireTourist, initiateStripePaymentForBooking);
router.post("/payment/stripe-initiate", verifyToken, requireTourist, initiateStripePaymentForBooking);
router.post("/payment/verify", verifyToken, requireTourist, verifyEsewaPaymentAndCreateBooking);
router.get("/payment/session/:sessionToken", verifyToken, requireTourist, getPaymentSessionStatus);
router.get("/my", verifyToken, requireTourist, getMyBookings);
router.patch("/:bookingId/cancel", verifyToken, requireTourist, cancelTouristBooking);

router.get("/host", verifyToken, requireHost, getHostBookings);
router.get("/admin/payments", verifyToken, requireAdmin, getAdminBookingPayments);

export default router;
