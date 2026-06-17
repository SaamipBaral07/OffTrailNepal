import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER ? process.env.DB_USER : "postgres",
  host: process.env.DB_HOST ? process.env.DB_HOST : "localhost",
  database: process.env.DB_NAME ? process.env.DB_NAME : "offtrail_nepal",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "postgres",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO booking_refunds
        (booking_id, payment_id, session_id, tourist_id, requested_amount, approved_amount, currency,
         refund_reason, policy_rule, refund_status, provider, requested_at, created_at, updated_at)
       SELECT b.booking_id,
              p.payment_id,
              ps.session_id,
              b.tourist_id,
              p.amount,
              p.amount,
              'NPR',
              'Legacy cancelled paid booking requires refund audit',
              'legacy_cancelled_paid_booking_review',
              'requested',
              COALESCE(NULLIF(LOWER(p.payment_method), ''),
                       CASE WHEN COALESCE(ps.transaction_uuid, '') LIKE 'STPAY-%' THEN 'stripe' ELSE 'esewa' END),
              COALESCE(b.cancelled_at, b.updated_at, b.created_at, CURRENT_TIMESTAMP),
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
       FROM homestay_bookings b
       JOIN payments p ON p.booking_id = b.booking_id
       LEFT JOIN LATERAL (
         SELECT session_id, transaction_uuid
         FROM booking_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY session_id DESC
         LIMIT 1
       ) ps ON TRUE
       LEFT JOIN booking_refunds r ON r.booking_id = b.booking_id
       WHERE b.status = 'cancelled'
         AND p.payment_status = 'success'
         AND r.refund_id IS NULL
       RETURNING refund_id, booking_id`
    );

    const bookingIds = inserted.rows.map((row) => row.booking_id);

    let updatedBookingsCount = 0;
    let updatedPaymentsCount = 0;
    let updatedSessionsCount = 0;

    if (bookingIds.length > 0) {
      const updatedBookings = await client.query(
        `UPDATE homestay_bookings
         SET status = 'refund_requested',
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = ANY($1::int[])
           AND status = 'cancelled'`,
        [bookingIds]
      );
      updatedBookingsCount = updatedBookings.rowCount;

      const updatedPayments = await client.query(
        `UPDATE payments
         SET payment_status = 'refund_requested'
         WHERE booking_id = ANY($1::int[])
           AND payment_status = 'success'`,
        [bookingIds]
      );
      updatedPaymentsCount = updatedPayments.rowCount;

      const updatedSessions = await client.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'refund_requested',
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = ANY($1::int[])
           AND payment_status = 'success'`,
        [bookingIds]
      );
      updatedSessionsCount = updatedSessions.rowCount;
    }

    await client.query("COMMIT");

    console.log(
      "Backfill complete:",
      JSON.stringify(
        {
          refund_requests_created: inserted.rowCount,
          bookings_marked_refund_requested: updatedBookingsCount,
          payments_marked_refund_requested: updatedPaymentsCount,
          payment_sessions_marked_refund_requested: updatedSessionsCount,
        },
        null,
        2
      )
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

await run();
