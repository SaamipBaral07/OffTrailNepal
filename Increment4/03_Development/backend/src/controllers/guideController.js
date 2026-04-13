import pool from "../config/db.js";

const getGuideVerificationStatus = async (guideId) => {
  const result = await pool.query(
    `SELECT verification_status
     FROM guide_verifications
     WHERE guide_id = $1`,
    [guideId]
  );
  return result.rows[0]?.verification_status || null;
};

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
    const { trail_id, experience_level } = req.body;

    const verificationStatus = await getGuideVerificationStatus(guideId);
    if (verificationStatus !== "approved") {
      return res.status(403).json({
        message: "Guide verification must be approved by admin before creating listings",
      });
    }

    // Validate required fields
    if (!trail_id || !experience_level) {
      return res.status(400).json({
        message: "trail_id and experience_level are required",
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
      `INSERT INTO guide_trails (guide_id, trail_id, experience_level)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [guideId, trail_id, experience_level]
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
    const { experience_level, is_active } = req.body;

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
        experience_level = COALESCE($1, experience_level),
        is_active = COALESCE($2, is_active)
       WHERE id = $3 AND guide_id = $4
       RETURNING *`,
      [
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
      `SELECT gt.id, gt.experience_level,
              g.guide_id, g.full_name, g.experience_years, g.license_no,
              COALESCE(gr.avg_rating, 0) AS avg_rating,
              COALESCE(gr.total_reviews, 0) AS total_reviews
       FROM guide_trails gt
       JOIN guides g ON gt.guide_id = g.guide_id
       JOIN guide_verifications gv ON gv.guide_id = g.guide_id
       LEFT JOIN LATERAL (
         SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
                COUNT(*)::int AS total_reviews
         FROM guide_reviews r
         WHERE r.guide_id = g.guide_id
       ) gr ON true
       WHERE gt.trail_id = $1
         AND gt.is_active = true
         AND gv.verification_status = 'approved'
       ORDER BY g.experience_years DESC, g.full_name ASC`,
      [trailId]
    );

    res.status(200).json({ guides: result.rows });
  } catch (err) {
    console.error("Error fetching guides by trail:", err);
    res.status(500).json({ message: "Server error fetching guides" });
  }
};

/* =========================
   PUBLIC: GET ALL APPROVED GUIDES
   GET /api/guides/public
========================= */
export const getPublicGuides = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const region = String(req.query.region || "").trim().toLowerCase();
    const minRatingRaw = Number.parseFloat(req.query.minRating);
    const minRating = Number.isFinite(minRatingRaw) ? minRatingRaw : null;
    const sort = String(req.query.sort || "experience_desc").trim().toLowerCase();

    const result = await pool.query(
      `SELECT g.guide_id,
              g.full_name,
              g.experience_years,
              COALESCE(ROUND(AVG(gr.rating)::numeric, 1), 0) AS avg_rating,
              COUNT(DISTINCT gr.review_id)::int AS total_reviews,
              COUNT(DISTINCT gt.id)::int AS total_trails,
              COUNT(DISTINCT gs.service_id)::int AS total_services,
              MIN(gs.price_per_day) AS starting_price,
              COALESCE(
                JSON_AGG(
                  DISTINCT JSONB_BUILD_OBJECT(
                    'trail_id', t.trail_id,
                    'trail_name', t.trail_name,
                    'region', t.region
                  )
                ) FILTER (WHERE t.trail_id IS NOT NULL),
                '[]'::json
              ) AS trails
       FROM guides g
       JOIN guide_verifications gv ON gv.guide_id = g.guide_id
       LEFT JOIN guide_trails gt ON gt.guide_id = g.guide_id AND gt.is_active = true
       LEFT JOIN trekking_trails t ON t.trail_id = gt.trail_id
      LEFT JOIN guide_services gs
        ON gs.guide_id = g.guide_id
            AND gs.is_active = true
            AND gs.approval_status = 'approved'
       LEFT JOIN guide_reviews gr ON gr.guide_id = g.guide_id
       WHERE gv.verification_status = 'approved'
       GROUP BY g.guide_id
       ORDER BY g.created_at DESC`
    );

    let guides = result.rows.map((row) => {
      const trails = Array.isArray(row.trails) ? row.trails : [];
      const normalizedTrails = trails
        .filter((trail) => trail && trail.trail_id)
        .map((trail) => ({
          trail_id: Number(trail.trail_id),
          trail_name: String(trail.trail_name || "").trim(),
          region: String(trail.region || "").trim(),
        }));

      return {
        guide_id: Number(row.guide_id),
        full_name: row.full_name,
        experience_years: Number(row.experience_years || 0),
        avg_rating: Number(row.avg_rating || 0),
        total_reviews: Number(row.total_reviews || 0),
        total_trails: Number(row.total_trails || 0),
        total_services: Number(row.total_services || 0),
        starting_price: row.starting_price !== null ? Number(row.starting_price) : null,
        trails: normalizedTrails,
      };
    });

    if (q) {
      guides = guides.filter((guide) => {
        const nameHit = String(guide.full_name || "").toLowerCase().includes(q);
        const trailHit = guide.trails.some((trail) =>
          String(trail.trail_name || "").toLowerCase().includes(q)
        );
        const regionHit = guide.trails.some((trail) =>
          String(trail.region || "").toLowerCase().includes(q)
        );
        return nameHit || trailHit || regionHit;
      });
    }

    if (region) {
      guides = guides.filter((guide) =>
        guide.trails.some((trail) => String(trail.region || "").toLowerCase() === region)
      );
    }

    if (minRating !== null) {
      guides = guides.filter((guide) => Number(guide.avg_rating || 0) >= minRating);
    }

    const sorters = {
      experience_desc: (a, b) => b.experience_years - a.experience_years || b.avg_rating - a.avg_rating,
      rating_desc: (a, b) => b.avg_rating - a.avg_rating || b.total_reviews - a.total_reviews,
      reviews_desc: (a, b) => b.total_reviews - a.total_reviews || b.avg_rating - a.avg_rating,
      price_asc: (a, b) => {
        const priceA = Number.isFinite(a.starting_price) ? a.starting_price : Number.MAX_SAFE_INTEGER;
        const priceB = Number.isFinite(b.starting_price) ? b.starting_price : Number.MAX_SAFE_INTEGER;
        return priceA - priceB;
      },
      name_asc: (a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")),
    };

    const sorter = sorters[sort] || sorters.experience_desc;
    guides.sort(sorter);

    const regionSet = new Set();
    guides.forEach((guide) => {
      guide.trails.forEach((trail) => {
        if (trail.region) regionSet.add(trail.region);
      });
    });

    return res.status(200).json({
      guides,
      filters: {
        regions: Array.from(regionSet).sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (err) {
    console.error("Error fetching public guides:", err);
    return res.status(500).json({ message: "Server error fetching guides" });
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
        g.bank_name,
        g.bank_account_name,
        g.bank_account_number,
        g.created_at,
        COALESCE(gv.verification_status, 'not_submitted') AS verification_status,
        gv.citizenship_doc_path,
        gv.guide_license_doc_path,
        gv.rejection_reason,
        gv.reviewed_at,
        COUNT(DISTINCT gt.id) AS total_trails,
        COUNT(DISTINCT gs.service_id) AS total_services,
        COALESCE(ROUND(AVG(gr.rating), 1), 0) AS avg_rating
      FROM guides g
      LEFT JOIN guide_verifications gv ON g.guide_id = gv.guide_id
      LEFT JOIN guide_trails gt ON g.guide_id = gt.guide_id
      LEFT JOIN guide_services gs ON g.guide_id = gs.guide_id
      LEFT JOIN guide_reviews gr ON g.guide_id = gr.guide_id
      GROUP BY g.guide_id, g.bank_name, g.bank_account_name, g.bank_account_number, gv.verification_status, gv.citizenship_doc_path, gv.guide_license_doc_path, gv.rejection_reason, gv.reviewed_at
      ORDER BY g.created_at DESC
    `);
    
    res.status(200).json({ guides: result.rows });
  } catch (err) {
    console.error("Error fetching all guides for admin:", err);
    res.status(500).json({ message: "Server error fetching guides" });
  }
};
