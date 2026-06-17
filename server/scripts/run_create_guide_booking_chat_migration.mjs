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
  const migrationPath = path.resolve(__dirname, "../migrations/create_guide_booking_chat.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'guide_booking_chat_messages'
         AND column_name IN ('message_id', 'booking_id', 'guide_id', 'tourist_id', 'sender_id', 'sender_role', 'message_text', 'created_at')`
    );

    const requiredIndexes = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'guide_booking_chat_messages'
         AND indexname IN (
           'idx_guide_booking_chat_messages_booking_created',
           'idx_guide_booking_chat_messages_guide_unread',
           'idx_guide_booking_chat_messages_tourist_unread'
         )`
    );

    if (requiredColumns.rows.length >= 8 && requiredIndexes.rows.length >= 3) {
      console.log("Migration applied: guide booking chat schema is ready.");
      return;
    }

    console.error("Migration executed, but expected guide booking chat schema was not fully found.", {
      columns_found: requiredColumns.rows,
      indexes_found: requiredIndexes.rows,
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
