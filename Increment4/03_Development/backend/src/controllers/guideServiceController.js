import pool from "../config/db.js";

const ACTIVE_GUIDE_BOOKING_STATUSES = ["pending", "confirmed"];
const APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);

const normalizeApprovalStatus = (value) => String(value || "").trim().toLowerCase();

const parsePositiveInt = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

/* =========================
   CREATE SERVICE
   POST /api/guides/services
========================= */
export const createService = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    const { trail_id, title, price_per_day, max_group_size, min_booking_days, description } = req.body;

    const verificationCheck = await pool.query(
      `SELECT verification_status
       FROM guide_verifications
       WHERE guide_id = $1`,
      [guideId]
    );

    if (verificationCheck.rows[0]?.verification_status !== "approved") {
      return res.status(403).json({
        message: "Guide verification must be approved by admin before offering services",
      });
    }

    // Validate required fields
    if (!trail_id || !title || !price_per_day) {
      return res.status(400).json({
        message: "trail_id, title, and price_per_day are required",
      });
    }

    const parsedMaxGroupSize = parsePositiveInt(max_group_size, 1);
    if (!parsedMaxGroupSize) {
      return res.status(400).json({ message: "max_group_size must be a positive integer" });
    }

    const parsedMinBookingDays = parsePositiveInt(min_booking_days, 1);
    if (!parsedMinBookingDays) {
      return res.status(400).json({ message: "min_booking_days must be a positive integer" });
    }

    // Verify guide is actively assigned to this trail
    const assignmentCheck = await pool.query(
      `SELECT id FROM guide_trails
       WHERE guide_id = $1 AND trail_id = $2 AND is_active = true`,
      [guideId, trail_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({
        message: "You must be actively assigned to this trail before creating a service for it",
      });
    }

    // Insert service
    const result = await pool.query(
      `INSERT INTO guide_services
         (guide_id, trail_id, title, price_per_day, max_group_size, min_booking_days, description,
          approval_status, approval_rejection_reason, reviewed_by_admin_id, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NULL, NULL, NULL)
       RETURNING *`,
      [
        guideId,
        trail_id,
        title.trim(),
        parseFloat(price_per_day),
        parsedMaxGroupSize,
        parsedMinBookingDays,
        description || null,
      ]
    );

    // Return with trail info
    const fullResult = await pool.query(
      `SELECT gs.*, t.trail_name, t.region, t.difficulty_level
       FROM guide_services gs
       JOIN trekking_trails t ON gs.trail_id = t.trail_id
       WHERE gs.service_id = $1`,
      [result.rows[0].service_id]
    );

    res.status(201).json({
      message: "Service created and submitted for admin approval",
      service: fullResult.rows[0],
    });
  } catch (err) {
    console.error("Error creating guide service:", err);
    res.status(500).json({ message: "Server error creating service" });
  }
};

/* =========================
   GET MY SERVICES
   GET /api/guides/services
========================= */
export const getMyServices = async (req, res) => {
  try {
    const guideId = req.user.user_id;

    const result = await pool.query(
      `SELECT gs.*, t.trail_name, t.region, t.difficulty_level
       FROM guide_services gs
       JOIN trekking_trails t ON gs.trail_id = t.trail_id
       WHERE gs.guide_id = $1
       ORDER BY gs.created_at DESC`,
      [guideId]
    );

    res.status(200).json({ services: result.rows });
  } catch (err) {
    console.error("Error fetching guide services:", err);
    res.status(500).json({ message: "Server error fetching services" });
  }
};

/* =========================
   UPDATE SERVICE
   PUT /api/guides/services/:id
========================= */
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;
    const { title, price_per_day, max_group_size, min_booking_days, description, is_active } = req.body;

    const parsedMaxGroupSize = parsePositiveInt(max_group_size, undefined);
    if (max_group_size !== undefined && !parsedMaxGroupSize) {
      return res.status(400).json({ message: "max_group_size must be a positive integer" });
    }

    const parsedMinBookingDays = parsePositiveInt(min_booking_days, undefined);
    if (min_booking_days !== undefined && !parsedMinBookingDays) {
      return res.status(400).json({ message: "min_booking_days must be a positive integer" });
    }

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM guide_services WHERE service_id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Service not found or not owned by you" });
    }

    await pool.query(
      `UPDATE guide_services SET
        title         = COALESCE($1, title),
        price_per_day = COALESCE($2, price_per_day),
        max_group_size= COALESCE($3, max_group_size),
        min_booking_days = COALESCE($4, min_booking_days),
        description   = COALESCE($5, description),
        is_active     = COALESCE($6, is_active),
        approval_status = 'pending',
        approval_rejection_reason = NULL,
        reviewed_by_admin_id = NULL,
        reviewed_at = NULL,
        updated_at    = CURRENT_TIMESTAMP
       WHERE service_id = $7 AND guide_id = $8`,
      [
        title ? title.trim() : null,
        price_per_day ? parseFloat(price_per_day) : null,
        parsedMaxGroupSize,
        parsedMinBookingDays,
        description !== undefined ? (description || null) : null,
        typeof is_active === "boolean" ? is_active : null,
        id,
        guideId,
      ]
    );

    // Return updated service with trail info
    const fullResult = await pool.query(
      `SELECT gs.*, t.trail_name, t.region, t.difficulty_level
       FROM guide_services gs
       JOIN trekking_trails t ON gs.trail_id = t.trail_id
       WHERE gs.service_id = $1`,
      [id]
    );

    res.status(200).json({
      message: "Service updated and resubmitted for admin approval",
      service: fullResult.rows[0],
    });
  } catch (err) {
    console.error("Error updating guide service:", err);
    res.status(500).json({ message: "Server error updating service" });
  }
};

/* =========================
   DELETE SERVICE
   DELETE /api/guides/services/:id
========================= */
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM guide_services WHERE service_id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Service not found or not owned by you" });
    }

    await pool.query(
      `DELETE FROM guide_services WHERE service_id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("Error deleting guide service:", err);
    res.status(500).json({ message: "Server error deleting service" });
  }
};

/* =========================
   TOGGLE SERVICE ACTIVE
   PATCH /api/guides/services/:id/toggle-active
========================= */
export const toggleServiceActive = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;

    const result = await pool.query(
      `UPDATE guide_services
       SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
       WHERE service_id = $1 AND guide_id = $2
       RETURNING *`,
      [id, guideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Service not found or not owned by you" });
    }

    res.status(200).json({
      message: `Service ${result.rows[0].is_active ? "activated" : "deactivated"} successfully`,
      service: result.rows[0],
    });
  } catch (err) {
    console.error("Error toggling service status:", err);
    res.status(500).json({ message: "Server error toggling service status" });
  }
};

/* =========================
   PUBLIC: GET SERVICES BY TRAIL
   GET /api/trails/:trailId/services
========================= */
export const getPublicServicesByTrail = async (req, res) => {
  try {
    const { trailId } = req.params;

    const result = await pool.query(
      `SELECT
         gs.service_id,
         gs.title,
         gs.price_per_day,
         gs.max_group_size,
        gs.min_booking_days,
         gs.description,
         gs.created_at,
         g.guide_id,
         g.full_name    AS guide_name,
         g.experience_years,
         g.license_no,
         gt.experience_level,
         COALESCE(gr.avg_rating, 0) AS avg_rating,
         COALESCE(gr.total_reviews, 0) AS total_reviews,
         COALESCE(ga.manual_unavailable_dates, ARRAY[]::text[]) AS manual_unavailable_dates,
         COALESCE(gb.booked_dates, ARRAY[]::text[]) AS booked_dates
       FROM guide_services gs
       JOIN guides g         ON gs.guide_id  = g.guide_id
       JOIN guide_trails gt  ON gs.guide_id  = gt.guide_id
                            AND gs.trail_id  = gt.trail_id
       JOIN guide_verifications gv ON gs.guide_id = gv.guide_id
       LEFT JOIN LATERAL (
         SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
                COUNT(*)::int AS total_reviews
         FROM guide_reviews r
         WHERE r.guide_id = g.guide_id
       ) gr ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY(
           SELECT DISTINCT to_char(ga2.available_date::date, 'YYYY-MM-DD')
           FROM guide_availability ga2
           WHERE ga2.guide_id = g.guide_id
             AND ga2.is_available = false
             AND ga2.available_date >= CURRENT_DATE
           ORDER BY 1
         ) AS manual_unavailable_dates
       ) ga ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY(
           SELECT DISTINCT to_char(day_series::date, 'YYYY-MM-DD')
           FROM guide_package_bookings b2
           JOIN LATERAL generate_series(
             b2.start_date::date,
             b2.end_date::date,
             interval '1 day'
           ) AS day_series ON true
           WHERE b2.guide_id = g.guide_id
             AND b2.status = ANY($2::text[])
             AND b2.end_date >= CURRENT_DATE
           ORDER BY 1
         ) AS booked_dates
       ) gb ON true
       WHERE gs.trail_id = $1
         AND gs.is_active = true
         AND gs.approval_status = 'approved'
         AND gt.is_active = true
         AND gv.verification_status = 'approved'
       ORDER BY gs.price_per_day ASC`,
      [trailId, ACTIVE_GUIDE_BOOKING_STATUSES]
    );

    res.status(200).json({ services: result.rows });
  } catch (err) {
    console.error("Error fetching public services by trail:", err);
    res.status(500).json({ message: "Server error fetching services" });
  }
};

/* =========================
   PUBLIC: GET SERVICES BY GUIDE
   GET /api/guides/public/:guideId/services
========================= */
export const getPublicServicesByGuide = async (req, res) => {
  try {
    const guideId = parsePositiveInt(req.params.guideId);
    if (!guideId) {
      return res.status(400).json({ message: "guideId must be a positive integer" });
    }

    const result = await pool.query(
      `SELECT
         gs.service_id,
         gs.title,
         gs.price_per_day,
         gs.max_group_size,
         gs.min_booking_days,
         gs.description,
         gs.created_at,
         gs.trail_id,
         t.trail_name,
         t.region,
         g.guide_id,
         g.full_name AS guide_name,
         g.experience_years,
         COALESCE(gr.avg_rating, 0) AS avg_rating,
         COALESCE(gr.total_reviews, 0) AS total_reviews
       FROM guide_services gs
       JOIN guides g ON gs.guide_id = g.guide_id
       JOIN trekking_trails t ON gs.trail_id = t.trail_id
       JOIN guide_trails gt ON gs.guide_id = gt.guide_id AND gs.trail_id = gt.trail_id
       JOIN guide_verifications gv ON gs.guide_id = gv.guide_id
       LEFT JOIN LATERAL (
         SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
                COUNT(*)::int AS total_reviews
         FROM guide_reviews r
         WHERE r.guide_id = g.guide_id
       ) gr ON true
       WHERE gs.guide_id = $1
         AND gs.is_active = true
         AND gs.approval_status = 'approved'
         AND gt.is_active = true
         AND gv.verification_status = 'approved'
       ORDER BY gs.price_per_day ASC, gs.created_at DESC`,
      [guideId]
    );

    return res.status(200).json({ services: result.rows });
  } catch (err) {
    console.error("Error fetching public services by guide:", err);
    return res.status(500).json({ message: "Server error fetching guide services" });
  }
};

/* =========================
   ADMIN: GET GUIDE SERVICES
   GET /api/guides/admin/services
========================= */
export const getAdminGuideServices = async (req, res) => {
  try {
    const guideIdRaw = req.query.guide_id;
    const guideId = parsePositiveInt(guideIdRaw, undefined);
    if (guideIdRaw !== undefined && !guideId) {
      return res.status(400).json({ message: "guide_id must be a positive integer" });
    }

    const status = normalizeApprovalStatus(req.query.approval_status);
    if (status && !APPROVAL_STATUSES.has(status)) {
      return res.status(400).json({ message: "approval_status must be pending, approved, or rejected" });
    }

    const whereClauses = [];
    const values = [];

    if (guideId) {
      values.push(guideId);
      whereClauses.push(`gs.guide_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      whereClauses.push(`gs.approval_status = $${values.length}`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         gs.service_id,
         gs.guide_id,
         gs.trail_id,
         gs.title,
         gs.price_per_day,
         gs.max_group_size,
         gs.min_booking_days,
         gs.description,
         gs.is_active,
         gs.approval_status,
         gs.approval_rejection_reason,
         gs.reviewed_at,
         gs.created_at,
         gs.updated_at,
         g.full_name AS guide_name,
         t.trail_name,
         t.region
       FROM guide_services gs
       JOIN guides g ON g.guide_id = gs.guide_id
       JOIN trekking_trails t ON t.trail_id = gs.trail_id
       ${whereSql}
       ORDER BY
         CASE gs.approval_status
           WHEN 'pending' THEN 0
           WHEN 'rejected' THEN 1
           ELSE 2
         END,
         gs.created_at DESC`,
      values
    );

    return res.status(200).json({ services: result.rows });
  } catch (err) {
    console.error("Error fetching guide services for admin:", err);
    return res.status(500).json({ message: "Server error fetching guide services" });
  }
};

/* =========================
   ADMIN: UPDATE SERVICE APPROVAL
   PATCH /api/guides/admin/services/:id/approval-status
========================= */
export const updateGuideServiceApprovalStatus = async (req, res) => {
  try {
    const serviceId = parsePositiveInt(req.params.id);
    if (!serviceId) {
      return res.status(400).json({ message: "Service id must be a positive integer" });
    }

    const adminId = req.user.user_id;
    const approvalStatus = normalizeApprovalStatus(req.body?.approval_status);
    const rejectionReason = String(req.body?.rejection_reason || "").trim();

    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({ message: "approval_status must be approved or rejected" });
    }

    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "rejection_reason is required when rejecting a service" });
    }

    if (approvalStatus === "approved") {
      const verificationCheck = await pool.query(
        `SELECT gv.verification_status
         FROM guide_services gs
         LEFT JOIN guide_verifications gv ON gv.guide_id = gs.guide_id
         WHERE gs.service_id = $1`,
        [serviceId]
      );

      if (!verificationCheck.rows.length) {
        return res.status(404).json({ message: "Guide service not found" });
      }

      if (verificationCheck.rows[0]?.verification_status !== "approved") {
        return res.status(400).json({
          message: "Guide verification must be approved before approving this guide service",
        });
      }
    }

    const result = await pool.query(
      `UPDATE guide_services
       SET approval_status = $1,
           approval_rejection_reason = $2,
           reviewed_by_admin_id = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE service_id = $4
       RETURNING *`,
      [
        approvalStatus,
        approvalStatus === "rejected" ? rejectionReason : null,
        adminId,
        serviceId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Guide service not found" });
    }

    return res.status(200).json({
      message: `Guide service ${approvalStatus} successfully`,
      service: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating guide service approval status:", err);
    return res.status(500).json({ message: "Server error updating guide service approval status" });
  }
};
