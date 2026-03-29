import pool from "../config/db.js";

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldName} must be a positive integer`, value: null };
  }
  return { error: null, value: parsed };
};

const parseDateOnly = (value, fieldName) => {
  if (!value) {
    return { error: `${fieldName} is required`, value: null };
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${fieldName} is invalid`, value: null };
  }

  return { error: null, value: parsed };
};

const toDateOnly = (date) => date.toISOString().slice(0, 10);

const generateBookingCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `OTB-${stamp}-${rand}`;
};

export const createHomestayBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const {
      homestay_id,
      check_in_date,
      check_out_date,
      rooms_booked,
      guests_count,
      contact_phone,
      special_requests,
    } = req.body;

    const homestayId = Number.parseInt(homestay_id, 10);
    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    const checkInParsed = parseDateOnly(check_in_date, "check_in_date");
    const checkOutParsed = parseDateOnly(check_out_date, "check_out_date");
    const roomsParsed = parsePositiveInt(rooms_booked, "rooms_booked");
    const guestsParsed = parsePositiveInt(guests_count, "guests_count");

    const firstError =
      checkInParsed.error ||
      checkOutParsed.error ||
      roomsParsed.error ||
      guestsParsed.error;

    if (firstError) {
      return res.status(400).json({ message: firstError });
    }

    const checkInDate = checkInParsed.value;
    const checkOutDate = checkOutParsed.value;
    const roomsBooked = roomsParsed.value;
    const guestsCount = guestsParsed.value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return res.status(400).json({ message: "check_in_date cannot be in the past" });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: "check_out_date must be after check_in_date" });
    }

    await client.query("BEGIN");

    const homestayResult = await client.query(
      `SELECT homestay_id, host_id, name, location, price_per_night, capacity, total_rooms, available_rooms
       FROM homestays
       WHERE homestay_id = $1
         AND verified_status = 'approved'
         AND is_active = true
       FOR UPDATE`,
      [homestayId]
    );

    if (!homestayResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Homestay not available for booking" });
    }

    const homestay = homestayResult.rows[0];

    if (roomsBooked > Number(homestay.available_rooms || 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Not enough rooms available for selected booking" });
    }

    if (guestsCount > Number(homestay.capacity || 0) * roomsBooked) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Guest count exceeds allowed capacity for selected rooms" });
    }

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
    const totalPrice = Number(homestay.price_per_night) * roomsBooked * nights;

    const bookingResult = await client.query(
      `INSERT INTO homestay_bookings
        (booking_code, homestay_id, host_id, tourist_id, check_in_date, check_out_date, rooms_booked, guests_count, contact_phone, special_requests, status, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)
       RETURNING *`,
      [
        generateBookingCode(),
        homestayId,
        homestay.host_id,
        touristId,
        toDateOnly(checkInDate),
        toDateOnly(checkOutDate),
        roomsBooked,
        guestsCount,
        contact_phone || null,
        special_requests || null,
        totalPrice,
      ]
    );

    await client.query(
      `UPDATE homestays
       SET available_rooms = available_rooms - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $2`,
      [roomsBooked, homestayId]
    );

    await client.query("COMMIT");

    const booking = bookingResult.rows[0];

    return res.status(201).json({
      message: "Booking confirmed successfully",
      booking: {
        ...booking,
        nights,
        homestay_name: homestay.name,
        homestay_location: homestay.location,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating homestay booking:", err);
    return res.status(500).json({ message: "Server error creating booking" });
  } finally {
    client.release();
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const touristId = req.user.user_id;

    const result = await pool.query(
      `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location, h.contact_phone AS homestay_contact_phone,
              t.trail_id, t.trail_name
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE b.tourist_id = $1
       ORDER BY b.created_at DESC`,
      [touristId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error("Error fetching tourist bookings:", err);
    res.status(500).json({ message: "Server error fetching bookings" });
  }
};

export const getHostBookings = async (req, res) => {
  try {
    const hostId = req.user.user_id;

    const result = await pool.query(
      `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location,
              tr.trail_name,
              ts.full_name AS tourist_name, ts.email AS tourist_email, ts.phone AS tourist_phone
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       JOIN trekking_trails tr ON h.trail_id = tr.trail_id
       JOIN tourists ts ON b.tourist_id = ts.tourist_id
       WHERE b.host_id = $1
       ORDER BY b.created_at DESC`,
      [hostId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error("Error fetching host bookings:", err);
    res.status(500).json({ message: "Server error fetching bookings" });
  }
};

export const cancelTouristBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.booking_id, b.status, b.rooms_booked, b.homestay_id, b.tourist_id,
              h.total_rooms, h.available_rooms
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       WHERE b.booking_id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    if (booking.tourist_id !== touristId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can only cancel your own bookings" });
    }

    if (booking.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    await client.query(
      `UPDATE homestay_bookings
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    await client.query(
      `UPDATE homestays
       SET available_rooms = LEAST(total_rooms, available_rooms + $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $2`,
      [booking.rooms_booked, booking.homestay_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error cancelling booking:", err);
    return res.status(500).json({ message: "Server error cancelling booking" });
  } finally {
    client.release();
  }
};
