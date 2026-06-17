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
  const migrationPath = path.resolve(__dirname, "../migrations/create_invoices.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'invoices'
         AND column_name IN ('invoice_id', 'invoice_number', 'booking_type', 'booking_id', 'tourist_id', 'issued_at', 'total_amount', 'snapshot')`
    );

    const bookingUnique = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'invoices'
         AND indexdef ILIKE '%(booking_type, booking_id)%'
         AND indexdef ILIKE '%UNIQUE%'`
    );

    if (requiredColumns.rows.length >= 8 && bookingUnique.rows.length > 0) {
      console.log("Migration applied: invoices table is ready.");
      return;
    }

    console.error("Migration executed, but expected invoice schema was not fully found.", {
      columns_found: requiredColumns.rows,
      unique_booking_indexes: bookingUnique.rows,
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
