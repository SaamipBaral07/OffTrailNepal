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
    "../migrations/add_min_booking_days_to_guide_services.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const columnCheck = await pool.query(
      `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'guide_services'
         AND column_name = 'min_booking_days'`
    );

    const invalidRows = await pool.query(
      `SELECT COUNT(*)::int AS invalid_count
       FROM guide_services
       WHERE min_booking_days IS NULL OR min_booking_days <= 0`
    );

    if (columnCheck.rows.length === 1 && invalidRows.rows[0].invalid_count === 0) {
      console.log("Migration applied: guide_services.min_booking_days is ready.");
      return;
    }

    console.error("Migration executed but validation failed.", {
      column: columnCheck.rows,
      invalid_count: invalidRows.rows[0]?.invalid_count,
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
