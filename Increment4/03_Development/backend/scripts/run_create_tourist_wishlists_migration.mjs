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
  const migrationPath = path.resolve(__dirname, "../migrations/create_tourist_wishlists.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tourist_wishlists'
         AND column_name IN ('wishlist_id', 'tourist_id', 'item_type', 'item_id', 'created_at')`
    );

    const hasUniqueConstraint = await pool.query(
      `SELECT constraint_name
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = 'tourist_wishlists'
         AND constraint_type = 'UNIQUE'`
    );

    const hasTypeCheck = await pool.query(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       WHERE c.conrelid = 'tourist_wishlists'::regclass
         AND c.contype = 'c'`
    );

    const hasColumns = requiredColumns.rows.length >= 5;
    const hasUnique = hasUniqueConstraint.rows.length > 0;
    const typeCheckOk = hasTypeCheck.rows.some((row) => {
      const def = String(row.def || "").toLowerCase();
      return def.includes("item_type") && def.includes("trail") && def.includes("homestay") && def.includes("guide");
    });

    if (hasColumns && hasUnique && typeCheckOk) {
      console.log("Migration applied: tourist wishlist schema is ready.");
      return;
    }

    console.error("Migration executed, but expected wishlist schema was not fully found.", {
      columns_found: requiredColumns.rows,
      unique_constraints: hasUniqueConstraint.rows,
      check_constraints: hasTypeCheck.rows,
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
