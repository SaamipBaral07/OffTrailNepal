import pool from "../config/db.js";

/* =========================
   GET ALL TRAILS (for dropdown)
========================= */
export const getTrailsForGuide = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT trail_id, trail_name, region, difficulty_level, duration_days
       FROM trekking_trails
       ORDER BY trail_name ASC`
    );
    res.status(200).json({ trails: result.rows });
  } catch (err) {
    console.error("Error fetching trails for guide:", err);
    res.status(500).json({ message: "Server error fetching trails" });
  }
};

/* =========================
   ADD GUIDE TO TRAIL
   POST /api/guides/trails
========================= */
export const addGuideToTrail = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    const { trail_id, price_per_day, experience_level } = req.body;

    // Validate required fields
    if (!trail_id || !price_per_day || !experience_level) {
      return res.status(400).json({
        message: "trail_id, price_per_day, and experience_level are required",
      });
    }

    // Validate experience_level
    const validLevels = ["beginner", "intermediate", "expert"];
    if (!validLevels.includes(experience_level)) {
      return res.status(400).json({
        message: "experience_level must be 'beginner', 'intermediate', or 'expert'",
      });
    }

    // Verify trail exists
    const trailCheck = await pool.query(
      `SELECT trail_id FROM trekking_trails WHERE trail_id = $1`,
      [trail_id]
    );
    if (trailCheck.rows.length === 0) {
      return res.status(400).json({ message: "Selected trail does not exist" });
    }

    // Check for duplicate
    const duplicateCheck = await pool.query(
      `SELECT id FROM guide_trails WHERE guide_id = $1 AND trail_id = $2`,
      [guideId, trail_id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ message: "You are already assigned to this trail" });
    }

    // Insert
    const result = await pool.query(
      `INSERT INTO guide_trails (guide_id, trail_id, price_per_day, experience_level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [guideId, trail_id, parseFloat(price_per_day), experience_level]
    );

    // Fetch with trail info
    const fullResult = await pool.query(
      `SELECT gt.*, t.trail_name, t.region, t.difficulty_level, t.duration_days
       FROM guide_trails gt
       JOIN trekking_trails t ON gt.trail_id = t.trail_id
       WHERE gt.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      message: "Successfully added to trail",
      guide_trail: fullResult.rows[0],
    });
  } catch (err) {
    console.error("Error adding guide to trail:", err);
    res.status(500).json({ message: "Server error adding guide to trail" });
  }
};

/* =========================
   GET MY TRAILS
   GET /api/guides/my-trails
========================= */
export const getMyTrails = async (req, res) => {
  try {
    const guideId = req.user.user_id;

    const result = await pool.query(
      `SELECT gt.*, t.trail_name, t.region, t.difficulty_level, t.duration_days
       FROM guide_trails gt
       JOIN trekking_trails t ON gt.trail_id = t.trail_id
       WHERE gt.guide_id = $1
       ORDER BY gt.created_at DESC`,
      [guideId]
    );

    res.status(200).json({ guide_trails: result.rows });
  } catch (err) {
    console.error("Error fetching guide trails:", err);
    res.status(500).json({ message: "Server error fetching your trails" });
  }
};

/* =========================
   UPDATE GUIDE TRAIL INFO
   PUT /api/guides/trails/:id
========================= */
export const updateGuideTrail = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;
    const { price_per_day, experience_level, is_active } = req.body;

    // Validate experience_level if provided
    if (experience_level) {
      const validLevels = ["beginner", "intermediate", "expert"];
      if (!validLevels.includes(experience_level)) {
        return res.status(400).json({
          message: "experience_level must be 'beginner', 'intermediate', or 'expert'",
        });
      }
    }

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM guide_trails WHERE id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Trail assignment not found or not owned by you" });
    }

    const result = await pool.query(
      `UPDATE guide_trails SET
        price_per_day = COALESCE($1, price_per_day),
        experience_level = COALESCE($2, experience_level),
        is_active = COALESCE($3, is_active)
       WHERE id = $4 AND guide_id = $5
       RETURNING *`,
      [
        price_per_day ? parseFloat(price_per_day) : null,
        experience_level || null,
        typeof is_active === "boolean" ? is_active : null,
        id,
        guideId,
      ]
    );

    // Fetch with trail info
    const fullResult = await pool.query(
      `SELECT gt.*, t.trail_name, t.region, t.difficulty_level, t.duration_days
       FROM guide_trails gt
       JOIN trekking_trails t ON gt.trail_id = t.trail_id
       WHERE gt.id = $1`,
      [id]
    );

    res.status(200).json({
      message: "Trail assignment updated successfully",
      guide_trail: fullResult.rows[0],
    });
  } catch (err) {
    console.error("Error updating guide trail:", err);
    res.status(500).json({ message: "Server error updating trail assignment" });
  }
};

/* =========================
   REMOVE GUIDE FROM TRAIL
   DELETE /api/guides/trails/:id
========================= */
export const removeGuideFromTrail = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM guide_trails WHERE id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Trail assignment not found or not owned by you" });
    }

    await pool.query(
      `DELETE FROM guide_trails WHERE id = $1 AND guide_id = $2`,
      [id, guideId]
    );

    res.status(200).json({ message: "Removed from trail successfully" });
  } catch (err) {
    console.error("Error removing guide from trail:", err);
    res.status(500).json({ message: "Server error removing from trail" });
  }
};

/* =========================
   TOGGLE GUIDE TRAIL ACTIVE
   PATCH /api/guides/trails/:id/toggle-active
========================= */
export const toggleGuideTrailActive = async (req, res) => {
  try {
    const { id } = req.params;
    const guideId = req.user.user_id;

    const result = await pool.query(
      `UPDATE guide_trails SET is_active = NOT is_active
       WHERE id = $1 AND guide_id = $2
       RETURNING *`,
      [id, guideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Trail assignment not found or not owned by you" });
    }

    res.status(200).json({
      message: `Trail ${result.rows[0].is_active ? "activated" : "deactivated"} successfully`,
      guide_trail: result.rows[0],
    });
  } catch (err) {
    console.error("Error toggling guide trail status:", err);
    res.status(500).json({ message: "Server error toggling status" });
  }
};

/* =========================
   PUBLIC: GET GUIDES BY TRAIL
   GET /api/guides/public/trail/:trailId
========================= */
export const getGuidesByTrail = async (req, res) => {
  try {
    const { trailId } = req.params;

    const result = await pool.query(
      `SELECT gt.id, gt.price_per_day, gt.experience_level,
              g.guide_id, g.full_name, g.phone, g.experience_years, g.license_no
       FROM guide_trails gt
       JOIN guides g ON gt.guide_id = g.guide_id
       WHERE gt.trail_id = $1
         AND gt.is_active = true
       ORDER BY gt.price_per_day ASC`,
      [trailId]
    );

    res.status(200).json({ guides: result.rows });
  } catch (err) {
    console.error("Error fetching guides by trail:", err);
    res.status(500).json({ message: "Server error fetching guides" });
  }
};

/* =========================
   ADMIN: GET ALL GUIDES WITH STATS
   GET /api/guides/admin/all
========================= */
export const getAllGuidesAdmin = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        g.guide_id, 
        g.full_name, 
        g.email, 
        g.phone, 
        g.experience_years, 
        g.created_at,
        COUNT(DISTINCT gt.id) AS total_trails,
        COUNT(DISTINCT gs.service_id) AS total_services,
        COALESCE(ROUND(AVG(gr.rating), 1), 0) AS avg_rating
      FROM guides g
      LEFT JOIN guide_trails gt ON g.guide_id = gt.guide_id
      LEFT JOIN guide_services gs ON g.guide_id = gs.guide_id
      LEFT JOIN guide_reviews gr ON g.guide_id = gr.guide_id
      GROUP BY g.guide_id
      ORDER BY g.created_at DESC
    `);
    
    res.status(200).json({ guides: result.rows });
  } catch (err) {
    console.error("Error fetching all guides for admin:", err);
    res.status(500).json({ message: "Server error fetching guides" });
  }
};
