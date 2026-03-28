import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

try {
  const cols = await pool.query(
    `SELECT table_schema, column_name
     FROM information_schema.columns
     WHERE table_name = 'refresh_tokens'
     ORDER BY table_schema, column_name`
  );

  console.log("refresh_tokens columns:");
  for (const row of cols.rows) {
    console.log(`- ${row.table_schema}.${row.column_name}`);
  }

  const selected = await pool.query("SELECT * FROM refresh_tokens LIMIT 0");
  console.log("\nSELECT refresh_tokens LIMIT 0 fields:");
  for (const field of selected.fields) {
    console.log(`- ${field.name}`);
  }
} catch (error) {
  console.error("Schema check failed:", error.message);
} finally {
  await pool.end();
}
