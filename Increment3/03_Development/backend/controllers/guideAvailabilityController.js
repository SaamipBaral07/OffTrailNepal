import pool from "../config/db.js";

/* =========================
   GET MY AVAILABILITY
   GET /api/guides/availability
========================= */
export const getMyAvailability = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    // Get dates from today onwards
    const result = await pool.query(
      `SELECT available_date, is_available 
       FROM guide_availability 
       WHERE guide_id = $1 AND available_date >= CURRENT_DATE 
       ORDER BY available_date ASC`,
      [guideId]
    );
    res.status(200).json({ availability: result.rows });
  } catch (err) {
    console.error("Error fetching availability:", err);
    res.status(500).json({ message: "Server error fetching availability" });
  }
};

/* =========================
   TOGGLE AVAILABILITY
   POST /api/guides/availability
========================= */
export const toggleAvailability = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    const { date, is_available } = req.body; // Expects YYYY-MM-DD

    if (!date || is_available === undefined) {
      return res.status(400).json({ message: "Date and is_available are required" });
    }

    // Upsert the availability for the specific date 
    const result = await pool.query(
      `INSERT INTO guide_availability (guide_id, available_date, is_available)
       VALUES ($1, $2, $3)
       ON CONFLICT (guide_id, available_date) 
       DO UPDATE SET is_available = EXCLUDED.is_available
       RETURNING *`,
      [guideId, date, is_available]
    );

    res.status(200).json({ 
      message: "Availability updated", 
      availability: result.rows[0] 
    });
  } catch (err) {
    console.error("Error updating availability:", err);
    res.status(500).json({ message: "Server error updating availability" });
  }
};
