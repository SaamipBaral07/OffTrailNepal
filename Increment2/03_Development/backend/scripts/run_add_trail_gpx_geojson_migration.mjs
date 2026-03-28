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
  const sql = fs.readFileSync("migrations/add_trail_gpx_geojson.sql", "utf8");

  try {
    await pool.query(sql);

    const verify = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trekking_trails' AND column_name = 'gpx_geojson'"
    );

    if (verify.rows.length > 0) {
      console.log(
        `Migration applied: ${verify.rows[0].column_name} column exists with type ${verify.rows[0].data_type}`
      );
    } else {
      console.log("Migration query executed, but gpx_geojson column was not found.");
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
