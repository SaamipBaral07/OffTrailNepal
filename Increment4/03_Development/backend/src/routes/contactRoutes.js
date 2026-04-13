import express from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../middleware/authMiddleware.js";
import { captureAdminActivity } from "../middleware/adminActivityMiddleware.js";
import {
  submitContactEnquiry,
  getContactEnquiriesForAdmin,
  replyToContactEnquiryAsAdmin,
  getMyContactEnquiryReplies,
  markMyContactEnquiryRepliesAsRead,
  submitTouristPlatformReview,
  getMyTouristPlatformReview,
  getAdminTouristPlatformReviews,
  toggleFeaturedTouristPlatformReview,
  getFeaturedTouristPlatformReviews,
} from "../controllers/contactController.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user.user_type !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  return captureAdminActivity(req, res, next);
};

const optionallyAttachUserFromToken = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch {
    // Treat invalid/expired token as anonymous submission for this public endpoint.
    return next();
  }
};

router.post("/enquiries", optionallyAttachUserFromToken, submitContactEnquiry);
router.get("/enquiries/admin", verifyToken, requireAdmin, getContactEnquiriesForAdmin);
router.post("/enquiries/:enquiryId/reply", verifyToken, requireAdmin, replyToContactEnquiryAsAdmin);
router.get("/enquiries/my-replies", verifyToken, getMyContactEnquiryReplies);
router.patch("/enquiries/my-replies/mark-read", verifyToken, markMyContactEnquiryRepliesAsRead);

router.get("/testimonials/featured", getFeaturedTouristPlatformReviews);
router.post("/testimonials", verifyToken, submitTouristPlatformReview);
router.get("/testimonials/me", verifyToken, getMyTouristPlatformReview);
router.get("/testimonials/admin", verifyToken, requireAdmin, getAdminTouristPlatformReviews);
router.patch("/testimonials/:reviewId/featured", verifyToken, requireAdmin, toggleFeaturedTouristPlatformReview);

export default router;