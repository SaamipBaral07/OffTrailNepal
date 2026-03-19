import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import {
  revokeAllUserRefreshTokens,
  selectActiveRefreshTokens,
  tokenRecordMatches
} from "../utils/refreshTokenStore.js";

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET ? process.env.JWT_SECRET + "_refresh" : null);

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
