import pool from "../config/db.js";

const toPositiveIntOrNull = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const reconcileHomestayAvailability = async ({ db = pool, homestayId = null } = {}) => {
  const scopedHomestayId = toPositiveIntOrNull(homestayId);
  const params = [];

  const activeScope = scopedHomestayId ? ` AND b.homestay_id = $1` : "";
  const homestayScope = scopedHomestayId ? `WHERE h.homestay_id = $1` : "";

  if (scopedHomestayId) {
    params.push(scopedHomestayId);
  }

  const result = await db.query(
    `WITH active_reserved AS (
       SELECT b.homestay_id,
              COALESCE(SUM(b.rooms_booked), 0)::int AS reserved_rooms
       FROM homestay_bookings b
       WHERE b.status = 'confirmed'
         AND b.check_out_date >= CURRENT_DATE
         ${activeScope}
       GROUP BY b.homestay_id
     ),
     computed AS (
       SELECT h.homestay_id,
              GREATEST(0, LEAST(h.total_rooms, h.total_rooms - COALESCE(ar.reserved_rooms, 0)))::int AS next_available_rooms
       FROM homestays h
       LEFT JOIN active_reserved ar ON ar.homestay_id = h.homestay_id
       ${homestayScope}
     )
     UPDATE homestays h
     SET available_rooms = c.next_available_rooms,
         updated_at = CURRENT_TIMESTAMP
     FROM computed c
     WHERE h.homestay_id = c.homestay_id
       AND h.available_rooms IS DISTINCT FROM c.next_available_rooms
     RETURNING h.homestay_id, h.available_rooms`,
    params
  );

  return {
    updatedCount: result.rowCount,
    updatedHomestays: result.rows,
  };
};
