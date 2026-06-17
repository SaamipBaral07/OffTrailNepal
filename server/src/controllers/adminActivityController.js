import pool from "../config/db.js";

const MAX_LIMIT = 100;

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseTimestamp = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};

export const getAdminActivityLogs = async (req, res) => {
  try {
    const requestedPage = parsePositiveInt(req.query?.page) || 1;
    const requestedLimit = parsePositiveInt(req.query?.limit) || 20;

    const page = requestedPage;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const adminIdFilter = parsePositiveInt(req.query?.admin_id);
    const actionTypeFilter = String(req.query?.action_type || "").trim();
    const entityTypeFilter = String(req.query?.entity_type || "").trim();
    const fromFilter = parseTimestamp(req.query?.from);
    const toFilter = parseTimestamp(req.query?.to);

    if ((req.query?.from && !fromFilter) || (req.query?.to && !toFilter)) {
      return res.status(400).json({ message: "Invalid from/to timestamp filter" });
    }

    const whereClauses = [];
    const values = [];

    if (adminIdFilter) {
      values.push(adminIdFilter);
      whereClauses.push(`l.admin_id = $${values.length}`);
    }

    if (actionTypeFilter) {
      values.push(actionTypeFilter);
      whereClauses.push(`l.action_type = $${values.length}`);
    }

    if (entityTypeFilter) {
      values.push(entityTypeFilter);
      whereClauses.push(`l.entity_type = $${values.length}`);
    }

    if (fromFilter) {
      values.push(fromFilter);
      whereClauses.push(`l.created_at >= $${values.length}::timestamp`);
    }

    if (toFilter) {
      values.push(toFilter);
      whereClauses.push(`l.created_at <= $${values.length}::timestamp`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*)::int AS total_records
      FROM admin_activity_log l
      ${whereSql}
    `;

    const rowsValues = [...values, limit, offset];

    const rowsQuery = `
      SELECT
        l.activity_id,
        l.admin_id,
        a.full_name AS admin_name,
        a.email AS admin_email,
        l.action_type,
        l.entity_type,
        l.entity_id,
        l.metadata,
        l.ip_address,
        l.user_agent,
        l.created_at
      FROM admin_activity_log l
      LEFT JOIN admins a ON a.admin_id = l.admin_id
      ${whereSql}
      ORDER BY l.created_at DESC, l.activity_id DESC
      LIMIT $${rowsValues.length - 1}
      OFFSET $${rowsValues.length}
    `;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(rowsQuery, rowsValues),
    ]);

    const totalRecords = Number(countResult.rows[0]?.total_records || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return res.status(200).json({
      activity_logs: rowsResult.rows,
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
      filters: {
        admin_id: adminIdFilter,
        action_type: actionTypeFilter || null,
        entity_type: entityTypeFilter || null,
        from: fromFilter,
        to: toFilter,
      },
    });
  } catch (err) {
    console.error("Error fetching admin activity logs:", err);
    return res.status(500).json({ message: "Server error while fetching admin activity logs" });
  }
};
