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
    "../migrations/create_host_verifications_and_homestay_document_requirements.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);

    const tableCheck = await pool.query(
      `SELECT to_regclass('public.host_verifications') AS host_verifications_table`
    );

    const homestayColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'homestays'
         AND column_name IN (
           'homestay_registration_certificate_doc_path',
           'property_ownership_doc_path',
           'property_ownership_type',
           'rejection_reason'
         )`
    );

    const hasTable = Boolean(tableCheck.rows[0]?.host_verifications_table);
    const hasColumns = homestayColumns.rows.length === 4;

    if (hasTable && hasColumns) {
      console.log("Migration applied: host verification and homestay document requirements are ready.");
      return;
    }

    console.error("Migration executed but validation failed.", {
      host_verifications_table: tableCheck.rows[0]?.host_verifications_table,
      homestay_columns_found: homestayColumns.rows.map((row) => row.column_name),
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
