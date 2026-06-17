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
  const migrationPath = path.resolve(
    __dirname,
    "../migrations/upgrade_guide_booking_workflow_status_refunds_timeline.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const timelineTable = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'guide_booking_timeline'`
    );

    const statusConstraints = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'guide_package_bookings'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%status%'`
    );

    const refundConstraints = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'guide_booking_refunds'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%refund_status%'`
    );

    const okTimeline = timelineTable.rows.length === 1;
    const okBookingStatus = statusConstraints.rows.some((row) => {
      const def = String(row.def || "");
      return def.includes("rejected") && def.includes("expired") && def.includes("refund_requested");
    });
    const okRefundStatus = refundConstraints.rows.some((row) => {
      const def = String(row.def || "");
      return def.includes("processing") && def.includes("refunded") && def.includes("rejected");
    });

    if (okTimeline && okBookingStatus && okRefundStatus) {
      console.log("Migration applied: guide booking workflow upgrade is ready.");
      return;
    }

    console.error("Migration executed, but expected workflow changes were not fully found.", {
      timelineTable: timelineTable.rows,
      statusConstraints: statusConstraints.rows,
      refundConstraints: refundConstraints.rows,
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
