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
    "../migrations/alter_tourist_wishlists_add_guide_package_type.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const checkConstraints = await pool.query(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       WHERE c.conrelid = 'tourist_wishlists'::regclass
         AND c.contype = 'c'`
    );

    const typeCheckOk = checkConstraints.rows.some((row) => {
      const def = String(row.def || "").toLowerCase();
      return (
        def.includes("item_type") &&
        def.includes("trail") &&
        def.includes("homestay") &&
        def.includes("guide_package")
      );
    });

    if (typeCheckOk) {
      console.log("Migration applied: tourist wishlist supports guide_package type.");
      return;
    }

    console.error("Migration executed, but expected wishlist type check was not found.", {
      check_constraints: checkConstraints.rows,
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
