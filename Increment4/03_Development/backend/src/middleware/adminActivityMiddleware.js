import { logAdminActivity } from "../utils/adminActivityLog.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const resolveEntityId = (params = {}) => {
  const priorityKeys = [
    "id",
    "reviewId",
    "enquiryId",
    "bookingId",
    "guideId",
    "hostId",
    "submissionId",
    "trailId",
    "homestayId",
    "imageId",
  ];

  for (const key of priorityKeys) {
    if (params[key] != null && String(params[key]).trim() !== "") {
      return String(params[key]);
    }
  }

  const firstKey = Object.keys(params)[0];
  if (!firstKey) {
    return null;
  }

  const value = params[firstKey];
  return value == null ? null : String(value);
};

const buildActionType = (req) => {
  const method = String(req.method || "").toUpperCase();
  const basePath = String(req.baseUrl || "");
  const routePath = req.route?.path ? String(req.route.path) : String(req.path || "");
  return `${method} ${basePath}${routePath}`.trim();
};

export const captureAdminActivity = (req, res, next) => {
  if (String(req.user?.user_type || "").trim().toLowerCase() !== "admin") {
    return next();
  }

  const method = String(req.method || "").toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return next();
  }

  const adminId = Number(req.user?.user_id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    return next();
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      return;
    }

    void logAdminActivity({
      req,
      adminId,
      actionType: buildActionType(req),
      entityType: "api_route",
      entityId: resolveEntityId(req.params || {}),
      metadata: {
        status_code: res.statusCode,
        duration_ms: Date.now() - startedAt,
        route_params: req.params || {},
        query_params: req.query || {},
      },
    });
  });

  return next();
};
