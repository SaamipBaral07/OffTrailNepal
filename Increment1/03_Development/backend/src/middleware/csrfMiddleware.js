import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrfToken";

const CSRF_IGNORED_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password"
]);

const getIsSecureCookie = () => process.env.COOKIE_SECURE !== "false";

export const generateCsrfToken = () => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
};

export const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: getIsSecureCookie(),
  sameSite: "strict",
  path: "/"
});

export const setCsrfTokenCookie = (res, token = generateCsrfToken()) => {
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
};

/**
 * Double-submit CSRF validation for state-changing requests.
 * Clients must send X-CSRF-Token header that matches csrfToken cookie.
 */
export const csrfProtection = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  if (CSRF_IGNORED_PATHS.has(req.path) || CSRF_IGNORED_PATHS.has(req.originalUrl)) {
    return next();
  }

  const headerToken = req.get("x-csrf-token");
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!headerToken || !cookieToken) {
    return res.status(403).json({ message: "CSRF token missing" });
  }

  const headerBuffer = Buffer.from(headerToken);
  const cookieBuffer = Buffer.from(cookieToken);

  if (
    headerBuffer.length !== cookieBuffer.length ||
    !crypto.timingSafeEqual(headerBuffer, cookieBuffer)
  ) {
    return res.status(403).json({ message: "CSRF token invalid" });
  }

  return next();
};
