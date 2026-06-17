import pool from "../config/db.js";

const getClientIp = (req) => {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim().slice(0, 64);
  }
  return String(req?.ip || "").trim().slice(0, 64) || null;
};

const normalizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
};

export const logAdminActivity = async ({
  db = pool,
  req,
  adminId,
  actionType,
  entityType,
  entityId = null,
  metadata = {},
}) => {
  const parsedAdminId = Number(adminId);

  if (!Number.isInteger(parsedAdminId) || parsedAdminId <= 0) {
    return;
  }

  const finalActionType = String(actionType || "").trim();
  const finalEntityType = String(entityType || "").trim();

  if (!finalActionType || !finalEntityType) {
    return;
  }

  const safeMetadata = normalizeMetadata(metadata);
  const ipAddress = getClientIp(req);
  const userAgent = String(req?.headers?.["user-agent"] || "").trim() || null;

  try {
    await db.query(
      `INSERT INTO admin_activity_log
         (admin_id, action_type, entity_type, entity_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        parsedAdminId,
        finalActionType,
        finalEntityType,
        entityId == null ? null : String(entityId),
        JSON.stringify(safeMetadata),
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    console.error("Failed to record admin activity:", err.message);
  }
};
