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
    "../migrations/add_account_lifecycle_fields_to_users.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const requiredColumns = [
      "is_suspended",
      "suspended_at",
      "suspended_reason",
      "deleted_at",
      "deleted_reason",
    ];

    const [touristColumns, hostColumns, guideColumns] = await Promise.all([
      pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'tourists'
           AND column_name = ANY($1::text[])`,
        [requiredColumns]
      ),
      pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'hosts'
           AND column_name = ANY($1::text[])`,
        [requiredColumns]
      ),
      pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'guides'
           AND column_name = ANY($1::text[])`,
        [requiredColumns]
      ),
    ]);

    const isComplete =
      touristColumns.rows.length === requiredColumns.length
      && hostColumns.rows.length === requiredColumns.length
      && guideColumns.rows.length === requiredColumns.length;

    if (isComplete) {
      console.log("Migration applied: account lifecycle fields are ready for tourists, hosts, and guides.");
      return;
    }

    console.error("Migration executed, but expected lifecycle columns were not fully found.", {
      tourists: touristColumns.rows,
      hosts: hostColumns.rows,
      guides: guideColumns.rows,
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
