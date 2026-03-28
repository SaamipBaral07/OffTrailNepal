import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../config/db.js";
import { setCsrfTokenCookie } from "../middleware/csrfMiddleware.js";
import {
  insertRefreshToken,
  revokeRefreshTokenById,
  revokeAllUserRefreshTokens,
  selectActiveRefreshTokens,
  tokenRecordMatches
} from "../utils/refreshTokenStore.js";
import { sendVerificationEmail } from "../utils/emailService.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET ? JWT_SECRET + "_refresh" : null);
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_SESSION_MAX_AGE_DAYS = Number(process.env.ABSOLUTE_SESSION_MAX_AGE_DAYS || 14);
const ABSOLUTE_SESSION_MAX_AGE_SECONDS = Math.max(1, Math.floor(ABSOLUTE_SESSION_MAX_AGE_DAYS * 24 * 60 * 60));
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_OTP_LENGTH = 6;
const REFRESH_COOKIE_NAME = "refreshToken";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false",
  sameSite: "strict",
  path: "/"
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateVerificationOtp = () => {
  const maxValue = 10 ** EMAIL_VERIFICATION_OTP_LENGTH;
  return crypto.randomInt(0, maxValue).toString().padStart(EMAIL_VERIFICATION_OTP_LENGTH, "0");
};

const hashVerificationOtp = (email, otp) => {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${String(otp || "").trim()}`)
    .digest("hex");
};

const isEmailRegistered = async (email, db = pool) => {
  const tables = ["tourists", "hosts", "guides", "admins"];

  for (const table of tables) {
    const existing = await db.query(
      `SELECT email FROM ${table} WHERE email = $1`,
      [email]
    );
    if (existing.rows.length > 0) {
      return true;
    }
  }

  return false;
};

const buildUserInsertConfig = (payload) => {
  const {
    full_name,
    email,
    password,
    phone,
    user_type,
    nationality,
    address,
    pan_number,
    experience_years,
    license_no
  } = payload;

  switch (user_type) {
    case "tourist":
      if (!nationality) {
        throw new Error("Nationality is required for tourists");
      }
      return {
        idColumn: "tourist_id",
        query: `
          INSERT INTO tourists (full_name, email, password, phone, nationality)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING tourist_id, full_name, email, phone, nationality, created_at
        `,
        values: [full_name, email, password, phone, nationality]
      };

    case "host":
      if (!address || !pan_number) {
        throw new Error("Address and PAN number are required for hosts");
      }
      return {
        idColumn: "host_id",
        query: `
          INSERT INTO hosts (full_name, email, password, phone, address, pan_number)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING host_id, full_name, email, phone, address, pan_number, created_at
        `,
        values: [full_name, email, password, phone, address, pan_number]
      };

    case "guide":
      if (!license_no || !experience_years || !address) {
        throw new Error("License number, experience years, and address are required for guides");
      }
      return {
        idColumn: "guide_id",
        query: `
          INSERT INTO guides (full_name, email, password, phone, license_no, experience_years, address)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING guide_id, full_name, email, phone, license_no, experience_years, address, created_at
        `,
        values: [full_name, email, password, phone, license_no, experience_years, address]
      };

    default:
      throw new Error("Invalid user type");
  }
};

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  process.exit(1);
}

// Helper: Get client IP from request
const getClientIp = (req) => {
  return (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
};

// Helper: Store refresh token in DB (supports both new and legacy schemas)
const storeRefreshToken = async (token, userId, userType, req) => {
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = getClientIp(req);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await insertRefreshToken(pool, {
    token,
    userId,
    userType,
    expiresAt,
    userAgent,
    ipAddress
  });
};

const issueSessionTokens = async (res, req, userId, userType, sessionStartedAt = Math.floor(Date.now() / 1000)) => {
  const accessToken = jwt.sign(
    { user_id: userId, user_type: userType },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    {
      user_id: userId,
      user_type: userType,
      type: "refresh",
      session_started_at: sessionStartedAt
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY
    }
  );

  await storeRefreshToken(refreshToken, userId, userType, req);
  const csrfToken = setCsrfTokenCookie(res);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return { accessToken, csrfToken };
};

/* =========================
   REGISTER CONTROLLER
========================= */
export const register = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      user_type,
      nationality,
      address,
      pan_number,
      experience_years,
      license_no
    } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (!full_name || !normalizedEmail || !password || !phone || !user_type) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    if (await isEmailRegistered(normalizedEmail)) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const pendingPayload = {
      full_name: full_name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      user_type,
      nationality,
      address,
      pan_number,
      experience_years,
      license_no
    };

    // Validate user-type-specific data before sending verification email.
    buildUserInsertConfig(pendingPayload);

    const verificationOtp = generateVerificationOtp();
    const tokenHash = hashVerificationOtp(normalizedEmail, verificationOtp);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);

    await pool.query(
      `INSERT INTO pending_user_verifications (email, token_hash, payload, expires_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (email)
       DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         payload = EXCLUDED.payload,
         expires_at = EXCLUDED.expires_at,
         used = false,
         verified_at = NULL,
         created_at = NOW()`,
      [normalizedEmail, tokenHash, JSON.stringify(pendingPayload), expiresAt]
    );

    await sendVerificationEmail({
      to: normalizedEmail,
      otp: verificationOtp
    });

    res.status(202).json({
      message: "Verification OTP sent to your email. Enter it to complete registration."
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/* =========================
   VERIFY EMAIL CONTROLLER
========================= */
export const verifyEmail = async (req, res) => {
  const email = normalizeEmail(req.body?.email || req.query?.email || "");
  const otp = String(req.body?.otp || req.query?.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email address" });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "OTP must be a 6-digit code" });
  }

  const tokenHash = hashVerificationOtp(email, otp);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const verificationResult = await client.query(
      `SELECT id, email, payload, used, expires_at
       FROM pending_user_verifications
       WHERE email = $1 AND token_hash = $2
       FOR UPDATE`,
      [email, tokenHash]
    );

    if (!verificationResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const verificationRow = verificationResult.rows[0];

    if (verificationRow.used) {
      await client.query("COMMIT");
      return res.status(200).json({ message: "Email already verified. You can log in." });
    }

    if (new Date(verificationRow.expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "OTP has expired. Please register again." });
    }

    const pendingPayload = verificationRow.payload;

    if (await isEmailRegistered(verificationRow.email, client)) {
      await client.query(
        `UPDATE pending_user_verifications
         SET used = true, verified_at = NOW()
         WHERE id = $1`,
        [verificationRow.id]
      );
      await client.query("COMMIT");
      return res.status(200).json({ message: "Email already verified. You can log in." });
    }

    const { query, values } = buildUserInsertConfig(pendingPayload);
    await client.query(query, values);

    await client.query(
      `UPDATE pending_user_verifications
       SET used = true, verified_at = NOW()
       WHERE id = $1`,
      [verificationRow.id]
    );

    await client.query(
      `DELETE FROM pending_user_verifications
       WHERE email = $1 AND id <> $2`,
      [verificationRow.email, verificationRow.id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Email verified successfully. You can now log in."
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Email verification error:", error);
    return res.status(500).json({ message: "Server error during email verification" });
  } finally {
    client.release();
  }
};

/* =========================
   LOGIN CONTROLLER
========================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const tables = [
      { name: "tourists", id: "tourist_id", type: "tourist" },
      { name: "hosts", id: "host_id", type: "host" },
      { name: "guides", id: "guide_id", type: "guide" },
      { name: "admins", id: "admin_id", type: "admin" }
    ];

    for (const table of tables) {
      const result = await pool.query(
        `SELECT * FROM ${table.name} WHERE email = $1`,
        [normalizedEmail]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const { accessToken, csrfToken } = await issueSessionTokens(
          res,
          req,
          user[table.id],
          table.type,
          Math.floor(Date.now() / 1000)
        );

        return res.json({
          message: "Login successful",
          token: accessToken,
          csrfToken,
          user: {
            id: user[table.id],
            full_name: user.full_name,
            email: user.email,
            user_type: table.type,
            created_at: user.created_at
          }
        });
      }
    }

    res.status(401).json({ message: "User not found" });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

/* =========================
   FORGOT PASSWORD
========================= */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at)
       VALUES ($1, $2, $3)`,
      [email, token, expiresAt]
    );

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Password Reset Link:",
        `http://localhost:3000/reset-password?token=${token}`
      );
    }

    res.json({
      message: "If the email exists, a password reset link has been sent."
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

/* =========================
   RESET PASSWORD
========================= */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const email = result.rows[0].email;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(`UPDATE tourists SET password = $1 WHERE email = $2`, [hashedPassword, email]);
    await pool.query(`UPDATE hosts SET password = $1 WHERE email = $2`, [hashedPassword, email]);
    await pool.query(`UPDATE guides SET password = $1 WHERE email = $2`, [hashedPassword, email]);
    await pool.query(`UPDATE admins SET password = $1 WHERE email = $2`, [hashedPassword, email]);

    await pool.query(
      `UPDATE password_reset_tokens SET used = true WHERE token = $1`,
      [token]
    );

    res.json({ message: "Password reset successful" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
export const getMe = async (req, res) => {
  try {
    return res.json({
      user_id: req.user.user_id,
      user_type: req.user.user_type
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   REFRESH TOKEN
========================= */
export const refreshTokenHandler = async (req, res) => {
  try {
    const { decoded, dbRecord } = req.refreshToken;

    // Rotate by revoking the current token row before issuing new credentials.
    await revokeRefreshTokenById(pool, dbRecord.id);

    const { accessToken: newAccessToken, csrfToken } = await issueSessionTokens(
      res,
      req,
      decoded.user_id,
      decoded.user_type,
      decoded.session_started_at || decoded.iat || Math.floor(Date.now() / 1000)
    );

    // Fetch full user profile
    const tableMap = {
      tourist: { table: "tourists", id: "tourist_id" },
      host:    { table: "hosts",    id: "host_id"    },
      guide:   { table: "guides",   id: "guide_id"   },
      admin:   { table: "admins",   id: "admin_id"   },
    };
    const tableInfo = tableMap[decoded.user_type];
    let userProfile = { id: decoded.user_id, user_type: decoded.user_type };
    if (tableInfo) {
      const profileResult = await pool.query(
        `SELECT ${tableInfo.id} AS id, full_name, email, created_at FROM ${tableInfo.table} WHERE ${tableInfo.id} = $1`,
        [decoded.user_id]
      );
      if (profileResult.rows.length > 0) {
        userProfile = { ...profileResult.rows[0], user_type: decoded.user_type };
      }
    }

    res.json({
      token: newAccessToken,
      csrfToken,
      user: userProfile,
      absoluteSessionMaxAgeSeconds: ABSOLUTE_SESSION_MAX_AGE_SECONDS
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   LOGOUT (revoke refresh token)
========================= */
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (req.refreshToken?.dbRecord?.id) {
      await revokeRefreshTokenById(pool, req.refreshToken.dbRecord.id);
    } else if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        if (decoded.type === "refresh") {
          const { rows: activeTokens, schema } = await selectActiveRefreshTokens(
            pool,
            decoded.user_id,
            decoded.user_type
          );

          for (const tokenRecord of activeTokens) {
            const match = await tokenRecordMatches(refreshToken, tokenRecord, schema);
            if (match) {
              await revokeRefreshTokenById(pool, tokenRecord.id);
              break;
            }
          }

          if (!activeTokens.length) {
            await revokeAllUserRefreshTokens(pool, decoded.user_id, decoded.user_type);
          }
        }
      } catch {
        // Invalid refresh token cookie; still clear cookies below.
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    res.clearCookie("csrfToken", { ...getRefreshCookieOptions(), httpOnly: false });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET CSRF TOKEN
========================= */
export const getCsrfToken = (req, res) => {
  const csrfToken = setCsrfTokenCookie(res);
  res.json({ csrfToken });
};
