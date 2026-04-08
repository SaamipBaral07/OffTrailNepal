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
  const migrationPath = path.resolve(__dirname, "../migrations/create_homestay_reviews.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'homestay_reviews'
         AND column_name IN ('review_id', 'homestay_id', 'booking_id', 'rating', 'created_at')`
    );

    const ratingCheck = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'homestay_reviews'::regclass
         AND contype = 'c'`
    );

    const uniqueBooking = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'homestay_reviews'
         AND indexdef ILIKE '%(booking_id)%'
         AND indexdef ILIKE '%UNIQUE%'`
    );

    const hasColumns = requiredColumns.rows.length >= 5;
    const hasRatingCheck = ratingCheck.rows.some((row) =>
      String(row.def || "").includes("rating") &&
      (
        String(row.def || "").includes("BETWEEN 1 AND 5") ||
        (String(row.def || "").includes("rating >= 1") && String(row.def || "").includes("rating <= 5"))
      )
    );
    const hasUniqueBooking = uniqueBooking.rows.length > 0;

    if (hasColumns && hasRatingCheck && hasUniqueBooking) {
      console.log("Migration applied: homestay reviews schema is ready.");
      return;
    }

    console.error("Migration executed, but expected homestay review schema was not fully found.", {
      columns_found: requiredColumns.rows,
      checks_found: ratingCheck.rows,
      unique_booking_indexes: uniqueBooking.rows,
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
