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

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET ? JWT_SECRET + "_refresh" : null);
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = "refreshToken";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== "false",
  sameSite: "strict",
  path: "/"
});

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

const issueSessionTokens = async (res, req, userId, userType) => {
  const accessToken = jwt.sign(
    { user_id: userId, user_type: userType },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { user_id: userId, user_type: userType, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
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

    if (!full_name || !email || !password || !phone || !user_type) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    // Check email across all role tables
    const tables = ["tourists", "hosts", "guides", "admins"];
    for (const table of tables) {
      const existing = await pool.query(
        `SELECT email FROM ${table} WHERE email = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let query, values, idColumn;

    switch (user_type) {
      case "tourist":
        if (!nationality) {
          return res.status(400).json({ message: "Nationality is required for tourists" });
        }
        query = `
          INSERT INTO tourists (full_name, email, password, phone, nationality)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING tourist_id, full_name, email, phone, nationality, created_at
        `;
        values = [full_name, email, hashedPassword, phone, nationality];
        idColumn = "tourist_id";
        break;

      case "host":
        if (!address || !pan_number) {
          return res.status(400).json({ message: "Address and PAN number are required for hosts" });
        }
        query = `
          INSERT INTO hosts (full_name, email, password, phone, address, pan_number)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING host_id, full_name, email, phone, address, pan_number, created_at
        `;
        values = [full_name, email, hashedPassword, phone, address, pan_number];
        idColumn = "host_id";
        break;

      case "guide":
        if (!license_no || !experience_years || !address) {
          return res.status(400).json({
            message: "License number, experience years, and address are required for guides"
          });
        }
        query = `
          INSERT INTO guides (full_name, email, password, phone, license_no, experience_years, address)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING guide_id, full_name, email, phone, license_no, experience_years, address, created_at
        `;
        values = [
          full_name,
          email,
          hashedPassword,
          phone,
          license_no,
          experience_years,
          address
        ];
        idColumn = "guide_id";
        break;

      default:
        return res.status(400).json({ message: "Invalid user type" });
    }

    const result = await pool.query(query, values);
    const user = result.rows[0];

    const { accessToken, csrfToken } = await issueSessionTokens(
      res,
      req,
      user[idColumn],
      user_type
    );

    res.status(201).json({
      message: "Registration successful",
      token: accessToken,
      csrfToken,
      user: {
        id: user[idColumn],
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        user_type,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/* =========================
   LOGIN CONTROLLER
========================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
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
        [email]
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
          table.type
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
      decoded.user_type
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
      user: userProfile
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
