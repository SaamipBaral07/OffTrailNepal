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
    "../migrations/remove_price_from_guide_trails_and_create_guide_package_bookings.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const tablesCheck = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('guide_package_bookings', 'guide_package_payment_sessions')`
    );

    const columnCheck = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'guide_trails'
         AND column_name = 'price_per_day'`
    );

    const hasTables = tablesCheck.rows.length === 2;
    const priceColumnRemoved = columnCheck.rows.length === 0;

    if (hasTables && priceColumnRemoved) {
      console.log("Migration applied: guide package booking schema is ready.");
      return;
    }

    console.error("Migration executed, but expected schema changes were not fully found.", {
      tablesFound: tablesCheck.rows,
      priceColumnCheck: columnCheck.rows,
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
