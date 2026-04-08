import fs from "fs";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER ? process.env.DB_USER : "postgres",
  host: process.env.DB_HOST ? process.env.DB_HOST : "localhost",
  database: process.env.DB_NAME ? process.env.DB_NAME : "offtrail_nepal",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD : "postgres",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

const run = async () => {
  const sql = fs.readFileSync("migrations/add_profile_image_to_users.sql", "utf8");

  try {
    await pool.query(sql);

    const verify = await pool.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'profile_image_path' AND table_name IN ('tourists','hosts','guides','admins') ORDER BY table_name"
    );

    if (verify.rows.length === 4) {
      console.log("Migration applied: profile_image_path exists in tourists/hosts/guides/admins.");
    } else {
      console.log("Migration executed, but verification found:", verify.rows);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

await run();
