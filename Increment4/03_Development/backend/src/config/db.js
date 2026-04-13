import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "offtrail_nepal",
  password: process.env.DB_PASSWORD || "postgres",
  port: parseInt(process.env.DB_PORT) || 5432,
  max: parseInt(process.env.DB_POOL_MAX || "8", 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "30000", 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || "5000", 10),
});

export default pool;
