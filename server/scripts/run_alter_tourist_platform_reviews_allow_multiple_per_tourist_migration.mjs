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
    "../migrations/alter_tourist_platform_reviews_allow_multiple_per_tourist.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const uniqueConstraintResult = await pool.query(
      `SELECT c.conname
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'tourist_platform_reviews'
         AND c.contype = 'u'
         AND pg_get_constraintdef(c.oid) ILIKE '%(tourist_id)%'`
    );

    if (uniqueConstraintResult.rowCount === 0) {
      console.log("Migration applied: tourist platform reviews now allow multiple submissions per tourist.");
      return;
    }

    console.error(
      "Migration executed, but tourist_id still appears to have a unique constraint.",
      uniqueConstraintResult.rows
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
