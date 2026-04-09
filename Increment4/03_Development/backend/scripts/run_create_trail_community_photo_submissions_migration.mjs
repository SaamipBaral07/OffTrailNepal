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
  const migrationPath = path.resolve(__dirname, "../migrations/create_trail_community_photo_submissions.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const submissionColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'trail_photo_submissions'
         AND column_name IN (
           'submission_id', 'trail_id', 'tourist_id', 'caption', 'trek_date',
           'status', 'admin_reviewed_by', 'admin_reviewed_at', 'admin_review_note',
           'approved_at', 'created_at', 'updated_at'
         )`
    );

    const imageColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'trail_photo_submission_images'
         AND column_name IN ('image_id', 'submission_id', 'image_path', 'display_order', 'created_at')`
    );

    const indexes = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'idx_trail_photo_submissions_trail_status_created',
           'idx_trail_photo_submissions_tourist_created',
           'idx_trail_photo_submission_images_submission_order'
         )`
    );

    if (submissionColumns.rows.length >= 12 && imageColumns.rows.length >= 5 && indexes.rows.length >= 3) {
      console.log("Migration applied: trail community photo submission schema is ready.");
      return;
    }

    console.error("Migration executed, but expected trail community photo schema was not fully found.", {
      submission_columns_found: submissionColumns.rows,
      image_columns_found: imageColumns.rows,
      indexes_found: indexes.rows,
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
