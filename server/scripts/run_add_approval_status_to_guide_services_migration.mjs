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
    "../migrations/add_approval_status_to_guide_services.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const columnCheck = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'guide_services'
         AND column_name IN ('approval_status', 'approval_rejection_reason', 'reviewed_by_admin_id', 'reviewed_at')`
    );

    const invalidStatusRows = await pool.query(
      `SELECT COUNT(*)::int AS invalid_count
       FROM guide_services
       WHERE approval_status NOT IN ('pending', 'approved', 'rejected')`
    );

    if (columnCheck.rows.length === 4 && Number(invalidStatusRows.rows[0]?.invalid_count || 0) === 0) {
      console.log("Migration applied: guide service approval workflow columns are ready.");
      return;
    }

    console.error("Migration executed but validation failed.", {
      columns_found: columnCheck.rows,
      invalid_status_rows: invalidStatusRows.rows[0]?.invalid_count,
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
