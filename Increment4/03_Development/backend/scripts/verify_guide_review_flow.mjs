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
  return `OTG-${stamp}`.slice(0, 24);
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
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { method: "GET", headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const run = async () => {
  const client = await pool.connect();

  try {
    const touristRes = await client.query(`SELECT tourist_id FROM tourists ORDER BY tourist_id ASC LIMIT 1`);
    if (!touristRes.rows.length) {
      throw new Error("Need at least one tourist in DB");
    }
    const touristId = touristRes.rows[0].tourist_id;

    const serviceRes = await client.query(
      `SELECT gs.service_id, gs.guide_id, gs.trail_id, gs.price_per_day, gs.title
       FROM guide_services gs
       JOIN guide_trails gt ON gt.guide_id = gs.guide_id AND gt.trail_id = gs.trail_id
       JOIN guide_verifications gv ON gv.guide_id = gs.guide_id
       WHERE gs.is_active = true
         AND gt.is_active = true
         AND gv.verification_status = 'approved'
       ORDER BY gs.service_id ASC
       LIMIT 1`
    );

    if (!serviceRes.rows.length) {
      throw new Error("No approved active guide service found");
    }

    const service = serviceRes.rows[0];
    const guideId = service.guide_id;
    const trailId = service.trail_id;

    let bookingId = null;

    const existingBooking = await client.query(
      `SELECT b.booking_id
       FROM guide_package_bookings b
       LEFT JOIN guide_reviews r ON r.booking_id = b.booking_id
       WHERE b.tourist_id = $1
         AND b.guide_id = $2
         AND b.status = 'confirmed'
         AND b.end_date < CURRENT_DATE
         AND r.review_id IS NULL
       ORDER BY b.booking_id DESC
       LIMIT 1`,
      [touristId, guideId]
    );

    if (existingBooking.rows.length) {
      bookingId = existingBooking.rows[0].booking_id;
    } else {
      const totalPrice = Number(service.price_per_day || 0) * 3;
      const inserted = await client.query(
        `INSERT INTO guide_package_bookings
          (booking_code, service_id, guide_id, tourist_id, trail_id, start_date, end_date, participants_count, status, total_price, decided_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, 1, 'confirmed', $8, CURRENT_TIMESTAMP)
         RETURNING booking_id`,
        [
          makeBookingCode(),
          service.service_id,
          guideId,
          touristId,
          trailId,
          toIsoDate(-7),
          toIsoDate(-4),
          totalPrice,
        ]
      );
      bookingId = inserted.rows[0].booking_id;
    }

    const touristToken = jwt.sign(
      { user_id: touristId, user_type: "tourist" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const guideToken = jwt.sign(
      { user_id: guideId, user_type: "guide" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const csrfToken = crypto.randomBytes(16).toString("hex");

    const reviewRes = await apiPost(
      `${baseUrl}/api/guide-bookings/${bookingId}/review`,
      touristToken,
      csrfToken,
      {
        rating: 5,
        comment: "Automated verification guide review: 5 out of 5 stars.",
      }
    );

    const myGuideBookingsRes = await apiGet(`${baseUrl}/api/guide-bookings/my`, touristToken);
    const reviewedInMyBookings = (myGuideBookingsRes.data.bookings || []).find((b) => b.booking_id === bookingId);

    const publicServicesRes = await apiGet(`${baseUrl}/api/trails/${trailId}/services`, null);
    const reviewedGuideService = (publicServicesRes.data.services || []).find(
      (row) => Number(row.guide_id) === Number(guideId)
    );

    const guideReviewsRes = await apiGet(`${baseUrl}/api/guides/reviews`, guideToken);
    const guideReviewFound = (guideReviewsRes.data.reviews || []).some((r) =>
      String(r.comment || "").includes("Automated verification guide review")
    );

    const guideBookingsRes = await apiGet(`${baseUrl}/api/guide-bookings/guide`, guideToken);
    const reviewFoundInGuideBookings = (guideBookingsRes.data.bookings || []).find((b) => b.booking_id === bookingId);

    const cleanupResult = await client.query(
      `DELETE FROM guide_reviews
       WHERE booking_id = $1
         AND comment ILIKE 'Automated verification guide review:%'`,
      [bookingId]
    );

    console.log(JSON.stringify({
      step_submit_review: {
        ok: reviewRes.ok,
        status: reviewRes.status,
        message: reviewRes.data?.message || null,
      },
      step_my_guide_bookings: {
        ok: myGuideBookingsRes.ok,
        status: myGuideBookingsRes.status,
        has_review_id: Boolean(reviewedInMyBookings?.review_id),
        review_rating: reviewedInMyBookings?.review_rating || null,
      },
      step_public_trail_services: {
        ok: publicServicesRes.ok,
        status: publicServicesRes.status,
        rating_visible: Boolean(reviewedGuideService),
        total_reviews: reviewedGuideService?.total_reviews ?? null,
        avg_rating: reviewedGuideService?.avg_rating ?? null,
      },
      step_guide_reviews_dashboard_source: {
        ok: guideReviewsRes.ok,
        status: guideReviewsRes.status,
        review_found: guideReviewFound,
      },
      step_guide_bookings_source: {
        ok: guideBookingsRes.ok,
        status: guideBookingsRes.status,
        has_review_id: Boolean(reviewFoundInGuideBookings?.review_id),
        review_rating: reviewFoundInGuideBookings?.review_rating || null,
      },
      cleanup: {
        removed_test_reviews: cleanupResult.rowCount,
      },
      booking_id: bookingId,
      service_id: service.service_id,
      trail_id: trailId,
      guide_id: guideId,
      tourist_id: touristId,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((err) => {
  console.error("verify_guide_review_flow failed:", err.message);
  process.exit(1);
});
