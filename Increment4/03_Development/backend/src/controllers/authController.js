import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/emailService.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import { setCsrfTokenCookie } from "../middleware/csrfMiddleware.js";
import {
  insertRefreshToken,
  revokeRefreshTokenById,
  revokeAllUserRefreshTokens,
  selectActiveRefreshTokens,
  tokenRecordMatches
} from "../utils/refreshTokenStore.js";

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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

const getUserTableInfo = (userType) => {
  const map = {
    tourist: { table: "tourists", idColumn: "tourist_id" },
    host: { table: "hosts", idColumn: "host_id" },
    guide: { table: "guides", idColumn: "guide_id" },
    admin: { table: "admins", idColumn: "admin_id" },
  };
  return map[userType] || null;
};

const deleteLocalUploadIfExists = (imagePath) => {
  if (!imagePath) return;
  const absolutePath = path.join(srcDir, String(imagePath).replace(/^\/+/, ""));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const getIsSecureCookie = () => {
  if (typeof process.env.COOKIE_SECURE === "string") {
    return process.env.COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: getIsSecureCookie(),
  sameSite: "strict",
  path: "/"
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const parseBankDetailsPayload = (payload) => {
  const bank_name = String(payload?.bank_name || "").trim();
  const bank_account_name = String(payload?.bank_account_name || "").trim();
  const bank_account_number = String(payload?.bank_account_number || "").trim();

  const hasAny = Boolean(bank_name || bank_account_name || bank_account_number);
  const hasAll = Boolean(bank_name && bank_account_name && bank_account_number);

  if (hasAny && !hasAll) {
    return {
      error: "bank_name, bank_account_name, and bank_account_number must all be provided together",
      value: null,
    };
  }

  if (bank_account_number.length > 40) {
    return {
      error: "bank_account_number must be 40 characters or fewer",
      value: null,
    };
  }

  return {
    error: null,
    value: {
      bank_name: bank_name || null,
      bank_account_name: bank_account_name || null,
      bank_account_number: bank_account_number || null,
    },
  };
};

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
    license_no,
    profile_image_path
  } = payload;

  switch (user_type) {
    case "tourist":
      if (!nationality) {
        throw new Error("Nationality is required for tourists");
      }
      return {
        idColumn: "tourist_id",
        query: `
          INSERT INTO tourists (full_name, email, password, phone, nationality, profile_image_path)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING tourist_id, full_name, email, phone, nationality, profile_image_path, created_at
        `,
        values: [full_name, email, password, phone, nationality, profile_image_path || null]
      };

    case "host":
      if (!address || !pan_number) {
        throw new Error("Address and PAN number are required for hosts");
      }
      return {
        idColumn: "host_id",
        query: `
          INSERT INTO hosts (full_name, email, password, phone, address, pan_number, profile_image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING host_id, full_name, email, phone, address, pan_number, profile_image_path, created_at
        `,
        values: [full_name, email, password, phone, address, pan_number, profile_image_path || null]
      };

    case "guide":
      if (!license_no || !experience_years || !address) {
        throw new Error("License number, experience years, and address are required for guides");
      }
      return {
        idColumn: "guide_id",
        query: `
          INSERT INTO guides (full_name, email, password, phone, license_no, experience_years, address, profile_image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING guide_id, full_name, email, phone, license_no, experience_years, address, profile_image_path, created_at
        `,
        values: [full_name, email, password, phone, license_no, experience_years, address, profile_image_path || null]
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
  const profile_image_path = req.file ? `/uploads/profiles/${req.file.filename}` : null;

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
      deleteLocalUploadIfExists(profile_image_path);
      return res.status(400).json({ message: "All required fields are missing" });
    }

    if (!isValidEmail(normalizedEmail)) {
      deleteLocalUploadIfExists(profile_image_path);
      return res.status(400).json({ message: "Invalid email address" });
    }

    if (await isEmailRegistered(normalizedEmail)) {
      deleteLocalUploadIfExists(profile_image_path);
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
      license_no,
      profile_image_path
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
            profile_image_path: user.profile_image_path || null,
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
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ 
        message: "If the email exists, a password reset link has been sent." 
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at)
       VALUES ($1, $2, $3)`,
      [normalizedEmail, token, expiresAt]
    );

    // Check if email exists in any user table and get the user's name
    const tables = ["tourists", "hosts", "guides", "admins"];
    let userFound = false;
    let fullName = "User";

    for (const table of tables) {
      const result = await pool.query(
        `SELECT full_name FROM ${table} WHERE email = $1`,
        [normalizedEmail]
      );
      if (result.rows.length > 0) {
        userFound = true;
        fullName = result.rows[0].full_name;
        break;
      }
    }

    // Send email only if user exists (but don't reveal email existence for security)
    if (userFound) {
      try {
        await sendPasswordResetEmail({
          to: normalizedEmail,
          resetToken: token,
          userName: fullName
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Still return success message to avoid revealing email existence
      }
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
   TOURIST PROFILE (GET)
========================= */
export const getTouristProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "tourist") {
      return res.status(403).json({ message: "Tourist access only" });
    }

    const result = await pool.query(
      `SELECT tourist_id AS id, full_name, email, phone, nationality, profile_image_path, created_at
       FROM tourists
       WHERE tourist_id = $1`,
      [req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Tourist profile not found" });
    }

    return res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Get tourist profile error:", error);
    return res.status(500).json({ message: "Server error fetching profile" });
  }
};

/* =========================
   TOURIST PROFILE (UPDATE)
========================= */
export const updateTouristProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "tourist") {
      return res.status(403).json({ message: "Tourist access only" });
    }

    const { full_name, phone, nationality } = req.body;

    const nextFullName = String(full_name || "").trim();
    const nextPhone = String(phone || "").trim();
    const nextNationality = String(nationality || "").trim();

    if (!nextFullName || !nextPhone || !nextNationality) {
      return res.status(400).json({ message: "full_name, phone, and nationality are required" });
    }

    const result = await pool.query(
      `UPDATE tourists
       SET full_name = $1,
           phone = $2,
           nationality = $3
       WHERE tourist_id = $4
       RETURNING tourist_id AS id, full_name, email, phone, nationality, profile_image_path, created_at`,
      [nextFullName, nextPhone, nextNationality, req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Tourist profile not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update tourist profile error:", error);
    return res.status(500).json({ message: "Server error updating profile" });
  }
};

/* =========================
   TOURIST PASSWORD (UPDATE)
========================= */
export const updateTouristPassword = async (req, res) => {
  try {
    if (req.user.user_type !== "tourist") {
      return res.status(403).json({ message: "Tourist access only" });
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: "current_password and new_password are required" });
    }

    if (String(new_password).length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const userResult = await pool.query(
      `SELECT password FROM tourists WHERE tourist_id = $1`,
      [req.user.user_id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "Tourist account not found" });
    }

    const matches = await bcrypt.compare(current_password, userResult.rows[0].password);
    if (!matches) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE tourists SET password = $1 WHERE tourist_id = $2`,
      [hashed, req.user.user_id]
    );

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update tourist password error:", error);
    return res.status(500).json({ message: "Server error updating password" });
  }
};

/* =========================
   HOST PROFILE (GET)
========================= */
export const getHostProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "host") {
      return res.status(403).json({ message: "Host access only" });
    }

    const result = await pool.query(
      `SELECT host_id AS id, full_name, email, phone, address, pan_number, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at
       FROM hosts
       WHERE host_id = $1`,
      [req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Host profile not found" });
    }

    return res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Get host profile error:", error);
    return res.status(500).json({ message: "Server error fetching host profile" });
  }
};

/* =========================
   HOST PROFILE (UPDATE)
========================= */
export const updateHostProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "host") {
      return res.status(403).json({ message: "Host access only" });
    }

    const { full_name, phone, address, pan_number } = req.body;

    const nextFullName = String(full_name || "").trim();
    const nextPhone = String(phone || "").trim();
    const nextAddress = String(address || "").trim();
    const nextPanNumber = String(pan_number || "").trim();

    if (!nextFullName || !nextPhone || !nextAddress || !nextPanNumber) {
      return res.status(400).json({ message: "full_name, phone, address, and pan_number are required" });
    }

    const result = await pool.query(
      `UPDATE hosts
       SET full_name = $1,
           phone = $2,
           address = $3,
           pan_number = $4
       WHERE host_id = $5
       RETURNING host_id AS id, full_name, email, phone, address, pan_number, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at`,
      [nextFullName, nextPhone, nextAddress, nextPanNumber, req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Host profile not found" });
    }

    return res.status(200).json({
      message: "Host profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update host profile error:", error);
    return res.status(500).json({ message: "Server error updating host profile" });
  }
};

/* =========================
   HOST BANK DETAILS (UPDATE)
========================= */
export const updateHostBankDetails = async (req, res) => {
  try {
    if (req.user.user_type !== "host") {
      return res.status(403).json({ message: "Host access only" });
    }

    const parsed = parseBankDetailsPayload(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const { bank_name, bank_account_name, bank_account_number } = parsed.value;

    const result = await pool.query(
      `UPDATE hosts
       SET bank_name = $1,
           bank_account_name = $2,
           bank_account_number = $3
       WHERE host_id = $4
       RETURNING host_id AS id, full_name, email, phone, address, pan_number, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at`,
      [bank_name, bank_account_name, bank_account_number, req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Host profile not found" });
    }

    return res.status(200).json({
      message: "Host bank details updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update host bank details error:", error);
    return res.status(500).json({ message: "Server error updating host bank details" });
  }
};

/* =========================
   GUIDE PROFILE (GET)
========================= */
export const getGuideProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "guide") {
      return res.status(403).json({ message: "Guide access only" });
    }

    const result = await pool.query(
      `SELECT guide_id AS id, full_name, email, phone, license_no, experience_years, address, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at
       FROM guides
       WHERE guide_id = $1`,
      [req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Guide profile not found" });
    }

    return res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Get guide profile error:", error);
    return res.status(500).json({ message: "Server error fetching guide profile" });
  }
};

/* =========================
   ADMIN PROFILE (GET)
========================= */
export const getAdminProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const result = await pool.query(
      `SELECT admin_id AS id, full_name, email, profile_image_path, created_at
       FROM admins
       WHERE admin_id = $1`,
      [req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Admin profile not found" });
    }

    return res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Get admin profile error:", error);
    return res.status(500).json({ message: "Server error fetching admin profile" });
  }
};

/* =========================
   GUIDE PROFILE (UPDATE)
========================= */
export const updateGuideProfile = async (req, res) => {
  try {
    if (req.user.user_type !== "guide") {
      return res.status(403).json({ message: "Guide access only" });
    }

    const { full_name, phone, license_no, experience_years, address } = req.body;

    const nextFullName = String(full_name || "").trim();
    const nextPhone = String(phone || "").trim();
    const nextLicenseNo = String(license_no || "").trim();
    const nextAddress = String(address || "").trim();
    const parsedExperience = Number(experience_years);

    if (!nextFullName || !nextPhone || !nextLicenseNo || !nextAddress || Number.isNaN(parsedExperience) || parsedExperience < 0) {
      return res.status(400).json({
        message: "full_name, phone, license_no, address, and valid experience_years are required",
      });
    }

    const result = await pool.query(
      `UPDATE guides
       SET full_name = $1,
           phone = $2,
           license_no = $3,
           experience_years = $4,
           address = $5
       WHERE guide_id = $6
       RETURNING guide_id AS id, full_name, email, phone, license_no, experience_years, address, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at`,
      [nextFullName, nextPhone, nextLicenseNo, parsedExperience, nextAddress, req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Guide profile not found" });
    }

    return res.status(200).json({
      message: "Guide profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update guide profile error:", error);
    return res.status(500).json({ message: "Server error updating guide profile" });
  }
};

/* =========================
   GUIDE BANK DETAILS (UPDATE)
========================= */
export const updateGuideBankDetails = async (req, res) => {
  try {
    if (req.user.user_type !== "guide") {
      return res.status(403).json({ message: "Guide access only" });
    }

    const parsed = parseBankDetailsPayload(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const { bank_name, bank_account_name, bank_account_number } = parsed.value;

    const result = await pool.query(
      `UPDATE guides
       SET bank_name = $1,
           bank_account_name = $2,
           bank_account_number = $3
       WHERE guide_id = $4
       RETURNING guide_id AS id, full_name, email, phone, license_no, experience_years, address, bank_name, bank_account_name, bank_account_number, profile_image_path, created_at`,
      [bank_name, bank_account_name, bank_account_number, req.user.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Guide profile not found" });
    }

    return res.status(200).json({
      message: "Guide bank details updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update guide bank details error:", error);
    return res.status(500).json({ message: "Server error updating guide bank details" });
  }
};

/* =========================
   PROFILE PHOTO (UPDATE)
========================= */
export const updateProfilePhoto = async (req, res) => {
  try {
    if (!req.user?.user_type || !req.user?.user_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Profile photo file is required" });
    }

    const tableInfo = getUserTableInfo(req.user.user_type);
    if (!tableInfo) {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const currentPhotoResult = await pool.query(
      `SELECT profile_image_path
       FROM ${tableInfo.table}
       WHERE ${tableInfo.idColumn} = $1`,
      [req.user.user_id]
    );

    if (!currentPhotoResult.rows.length) {
      deleteLocalUploadIfExists(`/uploads/profiles/${req.file.filename}`);
      return res.status(404).json({ message: "User account not found" });
    }

    const oldImagePath = currentPhotoResult.rows[0].profile_image_path;
    const nextImagePath = `/uploads/profiles/${req.file.filename}`;

    const result = await pool.query(
      `UPDATE ${tableInfo.table}
       SET profile_image_path = $1
       WHERE ${tableInfo.idColumn} = $2
       RETURNING full_name, email, profile_image_path`,
      [nextImagePath, req.user.user_id]
    );

    if (oldImagePath && oldImagePath !== nextImagePath) {
      deleteLocalUploadIfExists(oldImagePath);
    }

    return res.status(200).json({
      message: "Profile photo updated successfully",
      profile_image_path: result.rows[0].profile_image_path,
      user: {
        id: req.user.user_id,
        user_type: req.user.user_type,
        full_name: result.rows[0].full_name,
        email: result.rows[0].email,
        profile_image_path: result.rows[0].profile_image_path,
      },
    });
  } catch (error) {
    if (req.file) {
      deleteLocalUploadIfExists(`/uploads/profiles/${req.file.filename}`);
    }
    console.error("Update profile photo error:", error);
    return res.status(500).json({ message: "Server error updating profile photo" });
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
    const tableInfo = getUserTableInfo(decoded.user_type);
    let userProfile = { id: decoded.user_id, user_type: decoded.user_type };
    if (tableInfo) {
      const profileResult = await pool.query(
        `SELECT ${tableInfo.idColumn} AS id, full_name, email, profile_image_path, created_at FROM ${tableInfo.table} WHERE ${tableInfo.idColumn} = $1`,
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
