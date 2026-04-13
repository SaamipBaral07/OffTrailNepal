import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  generateTripPlan,
  getMyTripPlans,
  getMyTripPlanById,
  submitTripPlanFeedback,
  deleteTripPlan,
} from "../controllers/aiTripPlannerController.js";

const router = express.Router();

const requireTourist = (req, res, next) => {
  if (req.user.user_type !== "tourist") {
    return res.status(403).json({ message: "Tourist access only" });
  }
  return next();
};

router.post("/generate", verifyToken, requireTourist, generateTripPlan);
router.get("/my", verifyToken, requireTourist, getMyTripPlans);
router.get("/:planId", verifyToken, requireTourist, getMyTripPlanById);
router.post("/:planId/feedback", verifyToken, requireTourist, submitTripPlanFeedback);
router.delete("/:planId", verifyToken, requireTourist, deleteTripPlan);

export default router;
