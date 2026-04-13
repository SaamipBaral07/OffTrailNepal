import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getMyConversations,
  getMyConversationMessages,
  sendChatMessage,
  deleteConversation,
} from "../controllers/aiChatController.js";

const router = express.Router();

const requireTourist = (req, res, next) => {
  if (req.user.user_type !== "tourist") {
    return res.status(403).json({ message: "Tourist access only" });
  }
  return next();
};

router.get("/conversations", verifyToken, requireTourist, getMyConversations);
router.get("/conversations/:conversationId/messages", verifyToken, requireTourist, getMyConversationMessages);
router.post("/message", verifyToken, requireTourist, sendChatMessage);
router.post("/conversations/:conversationId/message", verifyToken, requireTourist, sendChatMessage);
router.delete("/conversations/:conversationId", verifyToken, requireTourist, deleteConversation);

export default router;
