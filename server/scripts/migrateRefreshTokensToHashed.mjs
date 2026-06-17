import dotenv from "dotenv";
import bcrypt from "bcrypt";
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

const ensureColumns = async () => {
  await pool.query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255)`);
  await pool.query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP`);
  await pool.query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512)`);
  await pool.query(`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
};

const backfillTokenHashes = async () => {
  const rows = await pool.query(
    `SELECT id, token
     FROM refresh_tokens
     WHERE token_hash IS NULL
       AND token IS NOT NULL`
  );

  for (const row of rows.rows) {
    const tokenHash = await bcrypt.hash(row.token, 10);
    await pool.query(
      `UPDATE refresh_tokens
       SET token_hash = $1
       WHERE id = $2`,
      [tokenHash, row.id]
    );
  }

  return rows.rowCount;
};

const enforceConstraintsAndCleanup = async () => {
  await pool.query(`DELETE FROM refresh_tokens WHERE token_hash IS NULL`);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refresh_tokens_token_hash_key'
      ) THEN
        ALTER TABLE refresh_tokens
        ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);
      END IF;
    END $$;
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id)`);

  await pool.query(`ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL`);

  const tokenColumnExists = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'refresh_tokens'
       AND column_name = 'token'`
  );

  if (tokenColumnExists.rowCount > 0) {
    await pool.query(`ALTER TABLE refresh_tokens DROP COLUMN token`);
  }
};

const printFinalSchema = async () => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'refresh_tokens'
     ORDER BY column_name`
  );

  console.log("Final refresh_tokens columns:");
  for (const row of result.rows) {
    console.log(`- ${row.column_name}`);
  }
};

try {
  console.log("Starting refresh_tokens migration to hashed storage...");

  await ensureColumns();
  const migratedCount = await backfillTokenHashes();
  await enforceConstraintsAndCleanup();
  await printFinalSchema();

  console.log(`Migration complete. Backfilled ${migratedCount} token(s).`);
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
