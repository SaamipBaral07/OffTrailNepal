import pool from "../config/db.js";

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

/* =========================
   GET MY AVAILABILITY
   GET /api/guides/availability
========================= */
export const getMyAvailability = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    // Get dates from today onwards
    const result = await pool.query(
      `SELECT to_char(available_date::date, 'YYYY-MM-DD') AS available_date,
              is_available 
       FROM guide_availability 
       WHERE guide_id = $1 AND available_date >= CURRENT_DATE 
       ORDER BY available_date ASC`,
      [guideId]
    );

    const bookedResult = await pool.query(
      `SELECT DISTINCT to_char(gs::date, 'YYYY-MM-DD') AS booked_date
       FROM guide_package_bookings b
       JOIN LATERAL generate_series(
         b.start_date::date,
         b.end_date::date,
         interval '1 day'
       ) AS gs ON TRUE
       WHERE b.guide_id = $1
         AND b.status = ANY($2::text[])
         AND b.end_date >= CURRENT_DATE
       ORDER BY booked_date ASC`,
      [guideId, ACTIVE_BOOKING_STATUSES]
    );

    res.status(200).json({
      availability: result.rows,
      booked_dates: bookedResult.rows.map((row) => row.booked_date),
    });
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

    if (!isIsoDate(date)) {
      return res.status(400).json({ message: "Date must be in YYYY-MM-DD format" });
    }

    const normalizedDate = String(date);

    const isBookedResult = await pool.query(
      `SELECT 1
       FROM guide_package_bookings b
       WHERE b.guide_id = $1
         AND b.status = ANY($2::text[])
         AND $3::date BETWEEN b.start_date::date AND b.end_date::date
       LIMIT 1`,
      [guideId, ACTIVE_BOOKING_STATUSES, normalizedDate]
    );

    if (isBookedResult.rowCount > 0) {
      return res.status(409).json({
        message: "This date is already booked by a tourist and cannot be changed manually.",
        code: "DATE_ALREADY_BOOKED",
      });
    }

    // Upsert the availability for the specific date 
    const result = await pool.query(
      `INSERT INTO guide_availability (guide_id, available_date, is_available)
       VALUES ($1, $2, $3)
       ON CONFLICT (guide_id, available_date) 
       DO UPDATE SET is_available = EXCLUDED.is_available
       RETURNING *`,
      [guideId, normalizedDate, Boolean(is_available)]
    );

    const updated = result.rows[0] || null;

    res.status(200).json({ 
      message: "Availability updated", 
      availability: updated
        ? {
            ...updated,
            // Return the same stable date key format the client uses.
            available_date: normalizedDate,
          }
        : null,
    });
  } catch (err) {
    console.error("Error updating availability:", err);
    res.status(500).json({ message: "Server error updating availability" });
  }
};
