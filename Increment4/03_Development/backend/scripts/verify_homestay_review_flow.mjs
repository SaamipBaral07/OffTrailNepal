import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER ? process.env.DB_USER : "postgres",
  host: process.env.DB_HOST ? process.env.DB_HOST : "localhost",
  database: process.env.DB_NAME ? process.env.DB_NAME : "offtrail_nepal",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "postgres",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}

const baseUrl = `http://localhost:${process.env.PORT || 5000}`;

const toIsoDate = (offsetDays) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const makeBookingCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  return `OTR-${stamp}`.slice(0, 24);
};

const apiPost = async (url, token, csrfToken, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-csrf-token": csrfToken,
      cookie: `csrfToken=${csrfToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const apiGet = async (url, token) => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const run = async () => {
  const client = await pool.connect();

  try {
    const hostRes = await client.query(`SELECT host_id FROM hosts ORDER BY host_id ASC LIMIT 1`);
    const touristRes = await client.query(`SELECT tourist_id FROM tourists ORDER BY tourist_id ASC LIMIT 1`);

    if (!hostRes.rows.length || !touristRes.rows.length) {
      throw new Error("Need at least one host and one tourist in DB");
    }

    const hostId = hostRes.rows[0].host_id;
    const touristId = touristRes.rows[0].tourist_id;

    const homestayRes = await client.query(
      `SELECT homestay_id, host_id
       FROM homestays
       WHERE host_id = $1 AND verified_status = 'approved' AND is_active = true
       ORDER BY homestay_id ASC
       LIMIT 1`,
      [hostId]
    );

    if (!homestayRes.rows.length) {
      throw new Error("No approved active homestay found for selected host");
    }

    const homestayId = homestayRes.rows[0].homestay_id;

    let bookingId = null;

    const existingBooking = await client.query(
      `SELECT b.booking_id
       FROM homestay_bookings b
       LEFT JOIN homestay_reviews r ON r.booking_id = b.booking_id
       WHERE b.tourist_id = $1
         AND b.homestay_id = $2
         AND b.status = 'confirmed'
         AND b.check_out_date < CURRENT_DATE
         AND r.review_id IS NULL
       ORDER BY b.booking_id DESC
       LIMIT 1`,
      [touristId, homestayId]
    );

    if (existingBooking.rows.length) {
      bookingId = existingBooking.rows[0].booking_id;
    } else {
      const insertBooking = await client.query(
        `INSERT INTO homestay_bookings
          (booking_code, homestay_id, host_id, tourist_id, check_in_date, check_out_date, rooms_booked, guests_count, status, total_price)
         VALUES
          ($1, $2, $3, $4, $5, $6, 1, 1, 'confirmed', 2500)
         RETURNING booking_id`,
        [
          makeBookingCode(),
          homestayId,
          hostId,
          touristId,
          toIsoDate(-5),
          toIsoDate(-2),
        ]
      );
      bookingId = insertBooking.rows[0].booking_id;
    }

    const touristToken = jwt.sign(
      { user_id: touristId, user_type: "tourist" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const hostToken = jwt.sign(
      { user_id: hostId, user_type: "host" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const csrfToken = crypto.randomBytes(16).toString("hex");

    const reviewRes = await apiPost(
      `${baseUrl}/api/bookings/${bookingId}/review`,
      touristToken,
      csrfToken,
      {
        rating: 5,
        comment: "Automated verification review: 5 out of 5 stars.",
      }
    );

    const myBookingsRes = await apiGet(`${baseUrl}/api/bookings/my`, touristToken);
    const reviewedInMyBookings = (myBookingsRes.data.bookings || []).find((b) => b.booking_id === bookingId);

    const publicHomestayRes = await fetch(`${baseUrl}/api/homestays/public/${homestayId}`);
    const publicHomestayData = await publicHomestayRes.json().catch(() => ({}));
    const publicReviewFound = (publicHomestayData.homestay?.reviews || []).some((r) =>
      String(r.comment || "").includes("Automated verification review")
    );

    const hostBookingsRes = await apiGet(`${baseUrl}/api/bookings/host`, hostToken);
    const hostReviewFound = (hostBookingsRes.data.bookings || []).find((b) => b.booking_id === bookingId);

    console.log(JSON.stringify({
      step_submit_review: {
        ok: reviewRes.ok,
        status: reviewRes.status,
        message: reviewRes.data?.message || null,
      },
      step_my_bookings: {
        ok: myBookingsRes.ok,
        status: myBookingsRes.status,
        has_review_id: Boolean(reviewedInMyBookings?.review_id),
        review_rating: reviewedInMyBookings?.review_rating || null,
      },
      step_public_homestay_detail: {
        ok: publicHomestayRes.ok,
        status: publicHomestayRes.status,
        review_found: publicReviewFound,
        total_reviews: publicHomestayData.homestay?.reviews_stats?.total_reviews ?? null,
      },
      step_host_dashboard_source: {
        ok: hostBookingsRes.ok,
        status: hostBookingsRes.status,
        has_review_id: Boolean(hostReviewFound?.review_id),
        review_rating: hostReviewFound?.review_rating || null,
      },
      booking_id: bookingId,
      homestay_id: homestayId,
      tourist_id: touristId,
      host_id: hostId,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((err) => {
  console.error("verify_homestay_review_flow failed:", err.message);
  process.exit(1);
});
