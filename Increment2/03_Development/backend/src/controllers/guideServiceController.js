import pool from "../config/db.js";

/* =========================
   CREATE SERVICE
   POST /api/guides/services
========================= */
export const createService = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    const { trail_id, title, price_per_day, max_group_size, description } = req.body;

    // Validate required fields
    if (!trail_id || !title || !price_per_day) {
      return res.status(400).json({
        message: "trail_id, title, and price_per_day are required",
      });
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
         (guide_id, trail_id, title, price_per_day, max_group_size, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        guideId,
        trail_id,
        title.trim(),
        parseFloat(price_per_day),
        max_group_size ? parseInt(max_group_size) : 1,
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
      message: "Service created successfully",
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
    const { title, price_per_day, max_group_size, description, is_active } = req.body;

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
        description   = COALESCE($4, description),
        is_active     = COALESCE($5, is_active),
        updated_at    = CURRENT_TIMESTAMP
       WHERE service_id = $6 AND guide_id = $7`,
      [
        title ? title.trim() : null,
        price_per_day ? parseFloat(price_per_day) : null,
        max_group_size ? parseInt(max_group_size) : null,
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
      message: "Service updated successfully",
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
         gs.description,
         gs.created_at,
         g.guide_id,
         g.full_name    AS guide_name,
         g.phone        AS guide_phone,
         g.experience_years,
         g.license_no,
         gt.experience_level
       FROM guide_services gs
       JOIN guides g         ON gs.guide_id  = g.guide_id
       JOIN guide_trails gt  ON gs.guide_id  = gt.guide_id
                            AND gs.trail_id  = gt.trail_id
       WHERE gs.trail_id = $1
         AND gs.is_active = true
         AND gt.is_active = true
       ORDER BY gs.price_per_day ASC`,
      [trailId]
    );

    res.status(200).json({ services: result.rows });
  } catch (err) {
    console.error("Error fetching public services by trail:", err);
    res.status(500).json({ message: "Server error fetching services" });
  }
};
