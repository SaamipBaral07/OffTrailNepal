import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { captureAdminActivity } from "../middleware/adminActivityMiddleware.js";
import {
  initiateGuideEsewaPayment,
  initiateGuideStripePayment,
  verifyGuideEsewaPaymentAndCreateBooking,
  handleGuideEsewaSuccessCallback,
  handleGuideEsewaFailureCallback,
  handleGuideStripeSuccessCallback,
  handleGuideStripeCancelCallback,
  getGuidePaymentSessionStatus,
  getMyGuideBookings,
  getGuideProviderBookings,
  submitGuideReview,
  updateGuideBookingStatus,
  requestGuideBookingRefund,
  getAdminGuideBookingPayments,
  reviewGuideBookingRefund,
  getGuideBookingTimeline,
} from "../controllers/guideBookingController.js";
import {
  getMyGuideBookingChats,
  getGuideBookingChatMessagesController,
  postGuideBookingChatMessageController,
  markGuideBookingChatReadController,
} from "../controllers/guideBookingChatController.js";

const router = express.Router();

const requireTourist = (req, res, next) => {
  if (req.user.user_type !== "tourist") {
    return res.status(403).json({ message: "Tourist access only" });
  }
  next();
};

const requireGuide = (req, res, next) => {
  if (req.user.user_type !== "guide") {
    return res.status(403).json({ message: "Guide access only" });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  return captureAdminActivity(req, res, next);
};

const requireTouristOrGuide = (req, res, next) => {
  if (req.user.user_type !== "tourist" && req.user.user_type !== "guide") {
    return res.status(403).json({ message: "Tourist or guide access only" });
  }
  next();
};

router.get("/payment/esewa/success", handleGuideEsewaSuccessCallback);
router.get("/payment/esewa/failure", handleGuideEsewaFailureCallback);
router.post("/payment/esewa/success", handleGuideEsewaSuccessCallback);
router.post("/payment/esewa/failure", handleGuideEsewaFailureCallback);
router.get("/payment/stripe/success", handleGuideStripeSuccessCallback);
router.get("/payment/stripe/cancel", handleGuideStripeCancelCallback);

router.post("/payment/initiate", verifyToken, requireTourist, initiateGuideEsewaPayment);
router.post("/payment/stripe/initiate", verifyToken, requireTourist, initiateGuideStripePayment);
router.post("/payment/verify", verifyToken, requireTourist, verifyGuideEsewaPaymentAndCreateBooking);
router.get("/payment/session/:sessionToken", verifyToken, requireTourist, getGuidePaymentSessionStatus);

router.get("/my", verifyToken, requireTourist, getMyGuideBookings);
router.get("/guide", verifyToken, requireGuide, getGuideProviderBookings);
router.get("/chats/my", verifyToken, requireTouristOrGuide, getMyGuideBookingChats);
router.get("/chats/:bookingId/messages", verifyToken, requireTouristOrGuide, getGuideBookingChatMessagesController);
router.post("/chats/:bookingId/messages", verifyToken, requireTouristOrGuide, postGuideBookingChatMessageController);
router.post("/chats/:bookingId/read", verifyToken, requireTouristOrGuide, markGuideBookingChatReadController);
router.post("/:bookingId/review", verifyToken, requireTourist, submitGuideReview);
router.get("/:bookingId/timeline", verifyToken, getGuideBookingTimeline);
router.patch("/:bookingId/status", verifyToken, requireGuide, updateGuideBookingStatus);
router.post("/:bookingId/refund/request", verifyToken, requireTourist, requestGuideBookingRefund);

router.get("/admin/payments", verifyToken, requireAdmin, getAdminGuideBookingPayments);
router.patch("/:bookingId/refund/review", verifyToken, requireAdmin, reviewGuideBookingRefund);

export default router;
