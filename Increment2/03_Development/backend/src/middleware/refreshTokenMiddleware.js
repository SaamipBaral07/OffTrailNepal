import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import {
  revokeAllUserRefreshTokens,
  selectActiveRefreshTokens,
  tokenRecordMatches
} from "../utils/refreshTokenStore.js";

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + "_refresh" : null);
const ABSOLUTE_SESSION_MAX_AGE_DAYS = Number(process.env.ABSOLUTE_SESSION_MAX_AGE_DAYS || 14);
const ABSOLUTE_SESSION_MAX_AGE_SECONDS = Math.max(1, Math.floor(ABSOLUTE_SESSION_MAX_AGE_DAYS * 24 * 60 * 60));

export const verifyRefreshToken = async (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  if (decoded.type !== "refresh") {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  // Absolute session timeout: rotation cannot extend this upper bound.
  const sessionStartedAt = Number(decoded.session_started_at || decoded.iat || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!sessionStartedAt || nowSeconds - sessionStartedAt > ABSOLUTE_SESSION_MAX_AGE_SECONDS) {
    await revokeAllUserRefreshTokens(pool, decoded.user_id, decoded.user_type);
    return res.status(401).json({
      message: "Session expired. Please login again.",
      code: "ABSOLUTE_SESSION_EXPIRED"
    });
  }

  const { rows: tokenRecords, schema } = await selectActiveRefreshTokens(
    pool,
    decoded.user_id,
    decoded.user_type
  );

  if (tokenRecords.length === 0) {
    return res.status(401).json({ message: "Refresh token not found or expired" });
  }

  let matchedTokenRecord = null;
  for (const record of tokenRecords) {
    const isMatch = await tokenRecordMatches(refreshToken, record, schema);
    if (isMatch) {
      matchedTokenRecord = record;
      break;
    }
  }

  if (!matchedTokenRecord) {
    await revokeAllUserRefreshTokens(
      pool,
      decoded.user_id,
      decoded.user_type
    );

    return res.status(401).json({
      message: "Token reuse detected. All sessions revoked. Please login again.",
      code: "TOKEN_REUSE_DETECTED"
    });
  }

  req.refreshToken = {
    raw: refreshToken,
    decoded,
    dbRecord: matchedTokenRecord
  };

  return next();
};
