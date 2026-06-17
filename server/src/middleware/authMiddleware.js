import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { getUserAccountState } from "../utils/accountLifecycle.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const accountState = await getUserAccountState(pool, decoded.user_type, decoded.user_id);
    if (!accountState.exists) {
      return res.status(401).json({ message: "User account not found" });
    }

    if (accountState.is_suspended) {
      return res.status(403).json({
        message: "Your account is suspended. Contact support.",
        code: "ACCOUNT_SUSPENDED",
        reason: String(accountState.suspended_reason || "").trim() || null,
      });
    }

    req.user = decoded; // { user_id, user_type }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Server error validating session" });
  }
};
