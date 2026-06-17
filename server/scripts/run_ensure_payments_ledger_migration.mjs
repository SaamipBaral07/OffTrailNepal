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
  const migrationPath = path.resolve(__dirname, "../migrations/ensure_payments_ledger.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const verify = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'payments'
         AND column_name IN ('booking_id', 'amount', 'payment_method', 'payment_status', 'transaction_reference', 'paid_at')`
    );

    const fkVerify = await pool.query(
      `SELECT ccu.table_name AS target_table
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'payments'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'booking_id'
       LIMIT 1`
    );

    if (verify.rows.length >= 6 && fkVerify.rows[0]?.target_table === "homestay_bookings") {
      console.log("Migration applied: payments ledger is ready.");
      return;
    }

    console.error(
      "Migration executed, but expected payments schema was not found:",
      { columns: verify.rows, fk_target_table: fkVerify.rows[0]?.target_table || null }
    );
    process.exitCode = 1;
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

await run();
