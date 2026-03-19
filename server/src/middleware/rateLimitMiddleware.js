import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const getClientIp = (req) => {
  return (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
};

/**
 * Rate limit for refresh token endpoint
 * 30 requests per 15 minutes per IP
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: "Too many refresh attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV !== "production";
  },
  keyGenerator: (req) => {
    // Use helper so IPv6 users are normalized safely.
    return ipKeyGenerator(getClientIp(req) || req.ip || "");
  },
});

/**
 * Stricter rate limit for login/register endpoints
 * 10 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== "production";
  },
  keyGenerator: (req) => {
    return ipKeyGenerator(getClientIp(req) || req.ip || "");
  },
});
