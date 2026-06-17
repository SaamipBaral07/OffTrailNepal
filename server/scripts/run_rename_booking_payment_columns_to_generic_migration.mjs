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
  const migrationPath = path.resolve(__dirname, "../migrations/rename_booking_payment_columns_to_generic.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const verify = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'booking_payment_sessions'
         AND column_name IN ('payment_ref_id', 'payment_response')`
    );

    const cols = new Set(verify.rows.map((row) => row.column_name));
    if (cols.has("payment_ref_id") && cols.has("payment_response")) {
      console.log("Migration applied: booking_payment_sessions uses payment_ref_id/payment_response.");
      return;
    }

    console.error("Migration executed, but expected columns were not found:", verify.rows);
    process.exitCode = 1;
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

await run();
