import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER ? process.env.DB_USER : "postgres",
  host: process.env.DB_HOST ? process.env.DB_HOST : "localhost",
  database: process.env.DB_NAME ? process.env.DB_NAME : "offtrail_nepal",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "postgres",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

const run = async () => {
  const migrationPath = path.resolve(__dirname, "../migrations/create_booking_refunds.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const refundsTable = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'booking_refunds'
         AND column_name IN ('refund_id', 'booking_id', 'refund_status', 'requested_amount', 'requested_at')`
    );

    const bookingStatuses = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'homestay_bookings'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%status%'`
    );

    const paymentStatuses = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'booking_payment_sessions'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%payment_status%'`
    );

    const hasRefundsTable = refundsTable.rows.length >= 5;
    const bookingStatusOk = bookingStatuses.rows.some((row) =>
      String(row.def || "").includes("refund_requested") && String(row.def || "").includes("refunded")
    );
    const paymentStatusOk = paymentStatuses.rows.some((row) =>
      String(row.def || "").includes("refund_requested") && String(row.def || "").includes("refunded")
    );

    if (hasRefundsTable && bookingStatusOk && paymentStatusOk) {
      console.log("Migration applied: refund workflow schema is ready.");
      return;
    }

    console.error("Migration executed, but expected refund schema changes were not fully found.", {
      refunds_columns_found: refundsTable.rows,
      booking_status_constraints: bookingStatuses.rows,
      payment_status_constraints: paymentStatuses.rows,
    });
    process.exitCode = 1;
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

await run();
