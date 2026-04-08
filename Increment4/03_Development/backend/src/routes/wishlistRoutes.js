import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getWishlistIds,
  getWishlistItems,
  toggleWishlistItem,
  removeWishlistItem,
} from "../controllers/wishlistController.js";

const router = express.Router();

const requireTourist = (req, res, next) => {
  if (req.user.user_type !== "tourist") {
    return res.status(403).json({ message: "Tourist access only" });
  }
  next();
};

router.get("/ids", verifyToken, requireTourist, getWishlistIds);
router.get("/", verifyToken, requireTourist, getWishlistItems);
router.post("/toggle", verifyToken, requireTourist, toggleWishlistItem);
router.delete("/:itemType/:itemId", verifyToken, requireTourist, removeWishlistItem);

export default router;
