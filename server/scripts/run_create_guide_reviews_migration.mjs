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
    "../migrations/create_guide_reviews_booking_link_and_cleanup.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = await pool.query(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'guide_reviews'
         AND column_name IN ('review_id', 'guide_id', 'user_id', 'booking_id', 'rating', 'created_at')`
    );

    const bookingIndex = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'guide_reviews'
         AND indexdef ILIKE '%(booking_id)%'
         AND indexdef ILIKE '%UNIQUE%'`
    );

    const bookingFk = await pool.query(
      `SELECT conname
       FROM pg_constraint
       WHERE conrelid = 'guide_reviews'::regclass
         AND contype = 'f'
         AND conname = 'guide_reviews_booking_id_fkey'`
    );

    const hasColumns = requiredColumns.rows.length >= 6;
    const bookingColumn = requiredColumns.rows.find((row) => row.column_name === "booking_id");
    const bookingNotNull = bookingColumn?.is_nullable === "NO";
    const hasUniqueBooking = bookingIndex.rows.length > 0;
    const hasBookingFk = bookingFk.rows.length > 0;

    if (hasColumns && bookingNotNull && hasUniqueBooking && hasBookingFk) {
      console.log("Migration applied: guide reviews are now booking-linked and legacy test rows were cleared.");
      return;
    }

    console.error("Migration executed, but expected guide review schema changes were not fully found.", {
      columns_found: requiredColumns.rows,
      unique_booking_indexes: bookingIndex.rows,
      booking_fk_found: bookingFk.rows,
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
