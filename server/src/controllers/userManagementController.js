import pool from "../config/db.js";
import { revokeAllUserRefreshTokens } from "../utils/refreshTokenStore.js";
import { getAccountTableInfo } from "../utils/accountLifecycle.js";

const ALLOWED_ROLES = new Set(["all", "tourist", "host", "guide"]);
const ALLOWED_VERIFICATION_STATUSES = new Set([
  "all",
  "not_submitted",
  "pending",
  "approved",
  "rejected",
]);
const ALLOWED_SORTS = new Set(["newest", "oldest", "name_asc", "name_desc"]);
const ALLOWED_USER_ACTIONS = new Set(["suspend", "reactivate"]);

const USERS_UNION_CTE = `
  users_union AS (
    SELECT
      'tourist'::text AS user_type,
      t.tourist_id::bigint AS user_id,
      t.full_name,
      t.email,
      t.phone,
      t.created_at,
      t.profile_image_path,
      NULL::text AS verification_status,
      COALESCE(t.is_suspended, false) AS is_suspended,
      t.suspended_at,
      t.suspended_reason,
      NULL::integer AS experience_years,
      NULL::text AS license_no,
      t.nationality,
      NULL::text AS address,
      NULL::text AS bank_name,
      NULL::text AS bank_account_name,
      NULL::text AS bank_account_number
    FROM tourists t

    UNION ALL

    SELECT
      'host'::text AS user_type,
      h.host_id::bigint AS user_id,
      h.full_name,
      h.email,
      h.phone,
      h.created_at,
      h.profile_image_path,
      COALESCE(hv.verification_status, 'not_submitted')::text AS verification_status,
      COALESCE(h.is_suspended, false) AS is_suspended,
      h.suspended_at,
      h.suspended_reason,
      NULL::integer AS experience_years,
      NULL::text AS license_no,
      NULL::text AS nationality,
      h.address,
      h.bank_name,
      h.bank_account_name,
      h.bank_account_number
    FROM hosts h
    LEFT JOIN host_verifications hv ON hv.host_id = h.host_id

    UNION ALL

    SELECT
      'guide'::text AS user_type,
      g.guide_id::bigint AS user_id,
      g.full_name,
      g.email,
      g.phone,
      g.created_at,
      g.profile_image_path,
      COALESCE(gv.verification_status, 'not_submitted')::text AS verification_status,
      COALESCE(g.is_suspended, false) AS is_suspended,
      g.suspended_at,
      g.suspended_reason,
      g.experience_years,
      g.license_no,
      NULL::text AS nationality,
      g.address,
      g.bank_name,
      g.bank_account_name,
      g.bank_account_number
    FROM guides g
    LEFT JOIN guide_verifications gv ON gv.guide_id = g.guide_id
  )
`;

const sortSqlMap = {
  newest: "created_at DESC, user_type ASC, user_id DESC",
  oldest: "created_at ASC, user_type ASC, user_id ASC",
  name_asc: "full_name ASC NULLS LAST, created_at DESC",
  name_desc: "full_name DESC NULLS LAST, created_at DESC",
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const buildFilters = ({ role, verificationStatus, q }) => {
  const values = [];
  const whereClauses = [];

  if (role !== "all") {
    values.push(role);
    whereClauses.push(`user_type = $${values.length}`);
  }

  if (verificationStatus !== "all") {
    values.push(verificationStatus);
    whereClauses.push(`verification_status = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    whereClauses.push(`(
      full_name ILIKE $${values.length}
      OR email ILIKE $${values.length}
      OR phone ILIKE $${values.length}
    )`);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  return { values, whereSql };
};

export const getAdminUserDirectory = async (req, res) => {
  try {
    const role = String(req.query.role || "all").trim().toLowerCase();
    const verificationStatus = String(req.query.verification_status || "all").trim().toLowerCase();
    const q = String(req.query.q || "").trim();
    const sort = String(req.query.sort || "newest").trim().toLowerCase();

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        message: "Invalid role filter. Allowed: all, tourist, host, guide",
      });
    }

    if (!ALLOWED_VERIFICATION_STATUSES.has(verificationStatus)) {
      return res.status(400).json({
        message: "Invalid verification_status filter. Allowed: all, not_submitted, pending, approved, rejected",
      });
    }

    if (!ALLOWED_SORTS.has(sort)) {
      return res.status(400).json({
        message: "Invalid sort value. Allowed: newest, oldest, name_asc, name_desc",
      });
    }

    const { values, whereSql } = buildFilters({ role, verificationStatus, q });

    const summarySql = `
      WITH ${USERS_UNION_CTE},
      filtered_users AS (
        SELECT *
        FROM users_union
        ${whereSql}
      )
      SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE user_type = 'tourist')::int AS tourist_count,
        COUNT(*) FILTER (WHERE user_type = 'host')::int AS host_count,
        COUNT(*) FILTER (WHERE user_type = 'guide')::int AS guide_count,
        COUNT(*) FILTER (WHERE verification_status = 'pending')::int AS pending_verifications,
        COUNT(*) FILTER (WHERE verification_status = 'approved')::int AS approved_verifications,
        COUNT(*) FILTER (WHERE verification_status = 'rejected')::int AS rejected_verifications,
        COUNT(*) FILTER (WHERE verification_status = 'not_submitted')::int AS not_submitted_verifications
      FROM filtered_users
    `;

    const usersSql = `
      WITH ${USERS_UNION_CTE},
      filtered_users AS (
        SELECT *
        FROM users_union
        ${whereSql}
      )
      SELECT
        user_type,
        user_id,
        full_name,
        email,
        phone,
        created_at,
        profile_image_path,
        verification_status,
        is_suspended,
        suspended_at,
        suspended_reason,
        CASE WHEN is_suspended = true THEN 'suspended' ELSE 'active' END AS account_status,
        experience_years,
        license_no,
        nationality,
        address,
        bank_name,
        bank_account_name,
        CASE
          WHEN COALESCE(NULLIF(TRIM(bank_name), ''), NULL) IS NOT NULL
            AND COALESCE(NULLIF(TRIM(bank_account_name), ''), NULL) IS NOT NULL
            AND COALESCE(NULLIF(TRIM(bank_account_number), ''), NULL) IS NOT NULL
          THEN true
          ELSE false
        END AS has_bank_profile,
        CASE
          WHEN bank_account_number IS NULL OR TRIM(bank_account_number) = '' THEN NULL
          WHEN CHAR_LENGTH(bank_account_number) <= 4 THEN bank_account_number
          ELSE CONCAT(
            REPEAT('*', GREATEST(CHAR_LENGTH(bank_account_number) - 4, 0)),
            RIGHT(bank_account_number, 4)
          )
        END AS bank_account_number_masked
      FROM filtered_users
      ORDER BY ${sortSqlMap[sort]}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const [summaryResult, usersResult] = await Promise.all([
      pool.query(summarySql, values),
      pool.query(usersSql, [...values, limit, offset]),
    ]);

    const summary = summaryResult.rows[0] || {
      total_records: 0,
      tourist_count: 0,
      host_count: 0,
      guide_count: 0,
      pending_verifications: 0,
      approved_verifications: 0,
      rejected_verifications: 0,
      not_submitted_verifications: 0,
    };

    const totalRecords = Number(summary.total_records || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return res.status(200).json({
      users: usersResult.rows,
      summary: {
        total_records: totalRecords,
        tourist_count: Number(summary.tourist_count || 0),
        host_count: Number(summary.host_count || 0),
        guide_count: Number(summary.guide_count || 0),
        pending_verifications: Number(summary.pending_verifications || 0),
        approved_verifications: Number(summary.approved_verifications || 0),
        rejected_verifications: Number(summary.rejected_verifications || 0),
        not_submitted_verifications: Number(summary.not_submitted_verifications || 0),
      },
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
      filters: {
        role,
        verification_status: verificationStatus,
        q,
        sort,
      },
    });
  } catch (err) {
    console.error("Error fetching admin user directory:", err);
    return res.status(500).json({ message: "Server error fetching user directory" });
  }
};

export const updateUserAccountLifecycle = async (req, res) => {
  try {
    const role = String(req.params.role || "").trim().toLowerCase();
    const userId = Number.parseInt(req.params.userId, 10);
    const action = String(req.body?.action || "").trim().toLowerCase();
    const reason = String(req.body?.reason || "").trim();

    if (!["tourist", "host", "guide"].includes(role)) {
      return res.status(400).json({ message: "role must be tourist, host, or guide" });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (!ALLOWED_USER_ACTIONS.has(action)) {
      return res.status(400).json({
        message: "Invalid action. Allowed: suspend, reactivate",
      });
    }

    if (action === "suspend" && reason.length < 5) {
      return res.status(400).json({
        message: "A reason of at least 5 characters is required for this action",
      });
    }

    const tableInfo = getAccountTableInfo(role);
    if (!tableInfo) {
      return res.status(400).json({ message: "Unsupported role" });
    }

    const existingResult = await pool.query(
      `SELECT
         ${tableInfo.idColumn} AS id,
         full_name,
         COALESCE(is_suspended, false) AS is_suspended,
         suspended_at,
         suspended_reason
       FROM ${tableInfo.table}
       WHERE ${tableInfo.idColumn} = $1`,
      [userId]
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    let updatedResult;

    if (action === "suspend") {
      updatedResult = await pool.query(
        `UPDATE ${tableInfo.table}
         SET
           is_suspended = true,
           suspended_at = CURRENT_TIMESTAMP,
           suspended_reason = $1
         WHERE ${tableInfo.idColumn} = $2
         RETURNING ${tableInfo.idColumn} AS id, full_name, is_suspended, suspended_at, suspended_reason`,
        [reason || null, userId]
      );

      await revokeAllUserRefreshTokens(pool, userId, role);
    }

    if (action === "reactivate") {
      updatedResult = await pool.query(
        `UPDATE ${tableInfo.table}
         SET
           is_suspended = false,
           suspended_at = NULL,
           suspended_reason = NULL
         WHERE ${tableInfo.idColumn} = $1
         RETURNING ${tableInfo.idColumn} AS id, full_name, is_suspended, suspended_at, suspended_reason`,
        [userId]
      );
    }

    const updated = updatedResult?.rows?.[0];

    return res.status(200).json({
      message: "User account lifecycle updated successfully",
      user: {
        role,
        user_id: updated?.id,
        full_name: updated?.full_name,
        is_suspended: Boolean(updated?.is_suspended),
        suspended_at: updated?.suspended_at || null,
        suspended_reason: updated?.suspended_reason || null,
        account_status: updated?.is_suspended ? "suspended" : "active",
      },
    });
  } catch (err) {
    console.error("Error updating user account lifecycle:", err);
    return res.status(500).json({ message: "Server error updating user account" });
  }
};
