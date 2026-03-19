import bcrypt from "bcrypt";

let schemaCache = null;

export const getRefreshTokenSchema = async (pool) => {
  if (schemaCache) {
    return schemaCache;
  }

  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'refresh_tokens'`
  );

  const columns = new Set(result.rows.map((row) => row.column_name));

  if (columns.size === 0) {
    throw new Error("refresh_tokens table does not exist");
  }

  schemaCache = {
    hasTokenHash: columns.has("token_hash"),
    hasRevokedAt: columns.has("revoked_at"),
    hasExpiresAt: columns.has("expires_at"),
    hasUserAgent: columns.has("user_agent"),
    hasIpAddress: columns.has("ip_address")
  };

  if (!schemaCache.hasTokenHash) {
    throw new Error("refresh_tokens schema missing token_hash column. Run migration.");
  }

  return schemaCache;
};

export const insertRefreshToken = async (
  pool,
  { token, userId, userType, expiresAt, userAgent, ipAddress }
) => {
  const schema = await getRefreshTokenSchema(pool);

  const columns = ["user_id", "user_type"];
  const values = [userId, userType];

  const tokenHash = await bcrypt.hash(token, 10);
  columns.push("token_hash");
  values.push(tokenHash);

  if (schema.hasExpiresAt) {
    columns.push("expires_at");
    values.push(expiresAt);
  }

  if (schema.hasUserAgent) {
    columns.push("user_agent");
    values.push(userAgent || "");
  }

  if (schema.hasIpAddress) {
    columns.push("ip_address");
    values.push(ipAddress || "");
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

  await pool.query(
    `INSERT INTO refresh_tokens (${columns.join(", ")}) VALUES (${placeholders})`,
    values
  );
};

export const selectActiveRefreshTokens = async (pool, userId, userType) => {
  const schema = await getRefreshTokenSchema(pool);

  const selectCols = ["id"];
  if (schema.hasTokenHash) {
    selectCols.push("token_hash");
  }

  const conditions = ["user_id = $1", "user_type = $2"];
  if (schema.hasRevokedAt) {
    conditions.push("revoked_at IS NULL");
  }
  if (schema.hasExpiresAt) {
    conditions.push("expires_at > NOW()");
  }

  const result = await pool.query(
    `SELECT ${selectCols.join(", ")}
     FROM refresh_tokens
     WHERE ${conditions.join(" AND ")}`,
    [userId, userType]
  );

  return { rows: result.rows, schema };
};

export const tokenRecordMatches = async (token, record, schema) => {
  if (schema.hasTokenHash && record.token_hash) {
    return bcrypt.compare(token, record.token_hash);
  }

  return false;
};

export const revokeRefreshTokenById = async (pool, id) => {
  const schema = await getRefreshTokenSchema(pool);

  if (schema.hasRevokedAt) {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return;
  }

  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [id]);
};

export const revokeAllUserRefreshTokens = async (pool, userId, userType) => {
  const schema = await getRefreshTokenSchema(pool);

  if (schema.hasRevokedAt) {
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND user_type = $2
         AND revoked_at IS NULL`,
      [userId, userType]
    );
    return;
  }

  await pool.query(
    `DELETE FROM refresh_tokens
     WHERE user_id = $1
       AND user_type = $2`,
    [userId, userType]
  );
};
