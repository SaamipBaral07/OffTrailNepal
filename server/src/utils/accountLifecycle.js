const ACCOUNT_TABLE_MAP = {
  tourist: { table: "tourists", idColumn: "tourist_id" },
  host: { table: "hosts", idColumn: "host_id" },
  guide: { table: "guides", idColumn: "guide_id" },
  admin: { table: "admins", idColumn: "admin_id" },
};

export const getAccountTableInfo = (userType) => {
  return ACCOUNT_TABLE_MAP[String(userType || "").trim().toLowerCase()] || null;
};

export const getUserAccountState = async (db, userType, userId) => {
  const info = getAccountTableInfo(userType);
  if (!info) {
    return { exists: false, is_suspended: false, deleted_at: null };
  }

  const isLifecycleManaged = ["tourist", "host", "guide"].includes(String(userType || "").trim().toLowerCase());

  if (!isLifecycleManaged) {
    const result = await db.query(
      `SELECT ${info.idColumn} AS id FROM ${info.table} WHERE ${info.idColumn} = $1`,
      [userId]
    );

    return {
      exists: result.rows.length > 0,
      is_suspended: false,
      deleted_at: null,
      suspended_at: null,
      suspended_reason: null,
      deleted_reason: null,
    };
  }

  const result = await db.query(
    `SELECT
       ${info.idColumn} AS id,
       COALESCE(is_suspended, false) AS is_suspended,
       suspended_at,
       suspended_reason,
       deleted_at,
       deleted_reason
     FROM ${info.table}
     WHERE ${info.idColumn} = $1`,
    [userId]
  );

  if (!result.rows.length) {
    return {
      exists: false,
      is_suspended: false,
      deleted_at: null,
      suspended_at: null,
      suspended_reason: null,
      deleted_reason: null,
    };
  }

  return {
    exists: true,
    ...result.rows[0],
  };
};
