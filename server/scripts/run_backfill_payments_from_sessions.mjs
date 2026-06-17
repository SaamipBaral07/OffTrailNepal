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

    const skippedInvalidResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM booking_payment_sessions ps
       WHERE ps.payment_status = 'success'
         AND ps.booking_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM homestay_bookings hb
           WHERE hb.booking_id = ps.booking_id
         )`
    );

    const updateResult = await client.query(
      `WITH source_rows AS (
         SELECT
           ps.booking_id,
           ROUND(COALESCE(ps.total_amount, ps.amount)::numeric, 2) AS amount,
           COALESCE(
             ps.payment_response->>'provider',
             CASE WHEN ps.transaction_uuid LIKE 'STPAY-%' THEN 'stripe' ELSE 'esewa' END
           ) AS payment_method,
           'success'::varchar AS payment_status,
           COALESCE(ps.payment_ref_id, ps.transaction_uuid) AS transaction_reference,
           COALESCE(ps.verified_at, CURRENT_TIMESTAMP) AS paid_at
         FROM booking_payment_sessions ps
         JOIN homestay_bookings hb ON hb.booking_id = ps.booking_id
         WHERE ps.payment_status = 'success'
           AND ps.booking_id IS NOT NULL
       )
       UPDATE payments p
       SET amount = s.amount,
           payment_method = s.payment_method,
           payment_status = s.payment_status,
           transaction_reference = COALESCE(s.transaction_reference, p.transaction_reference),
           paid_at = COALESCE(s.paid_at, p.paid_at)
       FROM source_rows s
       WHERE p.booking_id = s.booking_id`
    );

    const insertResult = await client.query(
      `INSERT INTO payments (booking_id, amount, payment_method, payment_status, transaction_reference, paid_at) 
       SELECT
         ps.booking_id,
         ROUND(COALESCE(ps.total_amount, ps.amount)::numeric, 2) AS amount,
         COALESCE(
           ps.payment_response->>'provider',
           CASE WHEN ps.transaction_uuid LIKE 'STPAY-%' THEN 'stripe' ELSE 'esewa' END
         ) AS payment_method,
         'success'::varchar AS payment_status,
         COALESCE(ps.payment_ref_id, ps.transaction_uuid) AS transaction_reference,
         COALESCE(ps.verified_at, CURRENT_TIMESTAMP) AS paid_at
       FROM booking_payment_sessions ps
       JOIN homestay_bookings hb ON hb.booking_id = ps.booking_id
       WHERE ps.payment_status = 'success'
         AND ps.booking_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM payments p
           WHERE p.booking_id = ps.booking_id
         )`
    );

    await client.query("COMMIT");

    const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM payments`);
    const skippedInvalidCount = skippedInvalidResult.rows[0].total;
    console.log(
      `Backfill complete. Updated: ${updateResult.rowCount}, Inserted: ${insertResult.rowCount}, ` +
        `Skipped invalid booking refs: ${skippedInvalidCount}, Total payments: ${countResult.rows[0].total}`
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
