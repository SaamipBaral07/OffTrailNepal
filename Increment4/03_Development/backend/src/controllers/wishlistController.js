import pool from "../config/db.js";

const ALLOWED_ITEM_TYPES = new Set(["trail", "homestay", "guide"]);

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeItemType = (value) => String(value || "").trim().toLowerCase();

const getPagination = (req) => {
  const pageRaw = parsePositiveInt(req.query.page);
  const limitRaw = parsePositiveInt(req.query.limit);

  const page = pageRaw || 1;
  const limit = Math.min(limitRaw || 12, 50);

  return { page, limit };
};

const validateWishlistTarget = async (itemType, itemId) => {
  if (itemType === "trail") {
    const result = await pool.query(
      `SELECT trail_id AS item_id
       FROM trekking_trails
       WHERE trail_id = $1`,
      [itemId]
    );
    return result.rows.length > 0;
  }

  if (itemType === "homestay") {
    const result = await pool.query(
      `SELECT homestay_id AS item_id
       FROM homestays
       WHERE homestay_id = $1
         AND verified_status = 'approved'
         AND is_active = true`,
      [itemId]
    );
    return result.rows.length > 0;
  }

  if (itemType === "guide") {
    const result = await pool.query(
      `SELECT g.guide_id AS item_id
       FROM guides g
       JOIN guide_verifications gv ON gv.guide_id = g.guide_id
       WHERE g.guide_id = $1
         AND gv.verification_status = 'approved'`,
      [itemId]
    );
    return result.rows.length > 0;
  }

  return false;
};

const getWishlistDetailMaps = async ({ trailIds, homestayIds, guideIds }) => {
  const [trailResult, homestayResult, guideResult] = await Promise.all([
    trailIds.length
      ? pool.query(
          `SELECT t.trail_id AS item_id,
                  t.trail_name AS title,
                  t.region,
                  t.difficulty_level,
                  t.duration_days,
                  t.max_altitude,
                  img.image_path
           FROM trekking_trails t
           LEFT JOIN LATERAL (
             SELECT image_path
             FROM trail_images ti
             WHERE ti.trail_id = t.trail_id
             ORDER BY ti.is_primary DESC, ti.uploaded_at ASC
             LIMIT 1
           ) img ON true
           WHERE t.trail_id = ANY($1::int[])`,
          [trailIds]
        )
      : Promise.resolve({ rows: [] }),
    homestayIds.length
      ? pool.query(
          `SELECT h.homestay_id AS item_id,
                  h.name AS title,
                  CONCAT(h.location, ', ', t.region) AS subtitle,
                  h.location,
                  t.region,
                  h.price_per_night,
                  h.available_rooms,
                  h.total_rooms,
                  COALESCE(rs.avg_rating, 0) AS avg_rating,
                  COALESCE(rs.total_reviews, 0) AS total_reviews,
                  img.image_path
           FROM homestays h
           JOIN trekking_trails t ON t.trail_id = h.trail_id
           LEFT JOIN LATERAL (
             SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
                    COUNT(*)::int AS total_reviews
             FROM homestay_reviews r
             WHERE r.homestay_id = h.homestay_id
           ) rs ON true
           LEFT JOIN LATERAL (
             SELECT image_path
             FROM homestay_images hi
             WHERE hi.homestay_id = h.homestay_id
             ORDER BY hi.is_primary DESC, hi.uploaded_at ASC
             LIMIT 1
           ) img ON true
           WHERE h.homestay_id = ANY($1::int[])
             AND h.verified_status = 'approved'
             AND h.is_active = true`,
          [homestayIds]
        )
      : Promise.resolve({ rows: [] }),
    guideIds.length
      ? pool.query(
          `SELECT g.guide_id AS item_id,
                  g.full_name AS title,
                  g.experience_years,
                  g.phone,
                  g.profile_image_path AS image_path,
                  COALESCE(gr.avg_rating, 0) AS avg_rating,
                  COALESCE(gr.total_reviews, 0) AS total_reviews
           FROM guides g
           JOIN guide_verifications gv ON gv.guide_id = g.guide_id
           LEFT JOIN LATERAL (
             SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
                    COUNT(*)::int AS total_reviews
             FROM guide_reviews r
             WHERE r.guide_id = g.guide_id
           ) gr ON true
           WHERE g.guide_id = ANY($1::int[])
             AND gv.verification_status = 'approved'`,
          [guideIds]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    trailMap: new Map(trailResult.rows.map((row) => [row.item_id, row])),
    homestayMap: new Map(homestayResult.rows.map((row) => [row.item_id, row])),
    guideMap: new Map(guideResult.rows.map((row) => [row.item_id, row])),
  };
};

const toCardItem = ({ record, detail }) => {
  const base = {
    wishlist_id: record.wishlist_id,
    item_type: record.item_type,
    item_id: record.item_id,
    created_at: record.created_at,
    removed: !detail,
  };

  if (!detail) {
    return {
      ...base,
      title: "Item unavailable",
      subtitle: "This listing may have been removed or is no longer publicly visible.",
      href: null,
      image_path: null,
      metadata: {},
    };
  }

  if (record.item_type === "trail") {
    return {
      ...base,
      title: detail.title,
      subtitle: detail.region,
      href: `/trails/${record.item_id}`,
      image_path: detail.image_path || null,
      metadata: {
        difficulty_level: detail.difficulty_level,
        duration_days: detail.duration_days,
        max_altitude: detail.max_altitude,
      },
    };
  }

  if (record.item_type === "homestay") {
    return {
      ...base,
      title: detail.title,
      subtitle: detail.subtitle,
      href: `/homestays/${record.item_id}`,
      image_path: detail.image_path || null,
      metadata: {
        price_per_night: detail.price_per_night,
        available_rooms: detail.available_rooms,
        total_rooms: detail.total_rooms,
        avg_rating: detail.avg_rating,
        total_reviews: detail.total_reviews,
      },
    };
  }

  return {
    ...base,
    title: detail.title,
    subtitle: `${detail.experience_years || 0} years experience`,
    href: null,
    image_path: detail.image_path || null,
    metadata: {
      experience_years: detail.experience_years,
      phone: detail.phone,
      avg_rating: detail.avg_rating,
      total_reviews: detail.total_reviews,
    },
  };
};

export const getWishlistIds = async (req, res) => {
  try {
    const touristId = req.user.user_id;

    const result = await pool.query(
      `SELECT item_type, item_id
       FROM tourist_wishlists
       WHERE tourist_id = $1
       ORDER BY created_at DESC`,
      [touristId]
    );

    const ids = {
      trail: [],
      homestay: [],
      guide: [],
    };

    for (const row of result.rows) {
      if (ids[row.item_type]) {
        ids[row.item_type].push(row.item_id);
      }
    }

    return res.status(200).json({ ids });
  } catch (err) {
    if (err?.code === "53300") {
      return res.status(503).json({
        message: "Database is temporarily busy. Please retry in a few seconds.",
      });
    }

    console.error("Error fetching wishlist ids:", err);
    return res.status(500).json({ message: "Server error fetching wishlist ids" });
  }
};

export const getWishlistItems = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const requestedType = normalizeItemType(req.query.type);
    const hasTypeFilter = Boolean(requestedType);

    if (hasTypeFilter && !ALLOWED_ITEM_TYPES.has(requestedType)) {
      return res.status(400).json({ message: "type must be one of trail, homestay, or guide" });
    }

    const { page, limit } = getPagination(req);
    const whereClauses = ["tourist_id = $1"];
    const values = [touristId];

    if (hasTypeFilter) {
      values.push(requestedType);
      whereClauses.push(`item_type = $${values.length}`);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM tourist_wishlists
       ${whereSql}`,
      values
    );

    const totalRecords = Number(totalResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    const normalizedPage = Math.min(page, totalPages);
    const offset = (normalizedPage - 1) * limit;

    const recordsResult = await pool.query(
      `SELECT wishlist_id, item_type, item_id, created_at
       FROM tourist_wishlists
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const records = recordsResult.rows;
    const trailIds = records.filter((row) => row.item_type === "trail").map((row) => row.item_id);
    const homestayIds = records.filter((row) => row.item_type === "homestay").map((row) => row.item_id);
    const guideIds = records.filter((row) => row.item_type === "guide").map((row) => row.item_id);

    const { trailMap, homestayMap, guideMap } = await getWishlistDetailMaps({
      trailIds,
      homestayIds,
      guideIds,
    });

    const items = records.map((record) => {
      const detail =
        record.item_type === "trail"
          ? trailMap.get(record.item_id)
          : record.item_type === "homestay"
            ? homestayMap.get(record.item_id)
            : guideMap.get(record.item_id);
      return toCardItem({ record, detail });
    });

    const countsResult = await pool.query(
      `SELECT item_type, COUNT(*)::int AS total
       FROM tourist_wishlists
       WHERE tourist_id = $1
       GROUP BY item_type`,
      [touristId]
    );

    const counts = { trail: 0, homestay: 0, guide: 0 };
    for (const row of countsResult.rows) {
      counts[row.item_type] = Number(row.total || 0);
    }

    return res.status(200).json({
      items,
      counts,
      pagination: {
        page: normalizedPage,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: normalizedPage > 1,
        has_next: normalizedPage < totalPages,
      },
    });
      if (err?.code === "53300") {
        return res.status(503).json({
          message: "Database is temporarily busy. Please retry in a few seconds.",
        });
      }

  } catch (err) {
    console.error("Error fetching wishlist items:", err);
    return res.status(500).json({ message: "Server error fetching wishlist" });
  }
};

export const toggleWishlistItem = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const itemType = normalizeItemType(req.body?.item_type);
    const itemId = parsePositiveInt(req.body?.item_id);

    if (!ALLOWED_ITEM_TYPES.has(itemType)) {
      return res.status(400).json({ message: "item_type must be trail, homestay, or guide" });
    }

    if (!itemId) {
      return res.status(400).json({ message: "item_id must be a positive integer" });
    }

    const targetExists = await validateWishlistTarget(itemType, itemId);
    if (!targetExists) {
      return res.status(404).json({ message: "Item not found or not publicly available" });
    }

    const existingResult = await pool.query(
      `SELECT wishlist_id
       FROM tourist_wishlists
       WHERE tourist_id = $1 AND item_type = $2 AND item_id = $3`,
      [touristId, itemType, itemId]
    );

    if (existingResult.rows.length > 0) {
      await pool.query(
        `DELETE FROM tourist_wishlists
         WHERE tourist_id = $1 AND item_type = $2 AND item_id = $3`,
        [touristId, itemType, itemId]
      );

      return res.status(200).json({
        message: "Removed from wishlist",
        wishlisted: false,
        item_type: itemType,
        item_id: itemId,
      });
    }

    await pool.query(
      `INSERT INTO tourist_wishlists (tourist_id, item_type, item_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (tourist_id, item_type, item_id) DO NOTHING`,
      [touristId, itemType, itemId]
    );

    return res.status(200).json({
      message: "Added to wishlist",
      wishlisted: true,
      item_type: itemType,
      item_id: itemId,
    });
  } catch (err) {
    console.error("Error toggling wishlist item:", err);
    return res.status(500).json({ message: "Server error toggling wishlist item" });
  }
};

export const removeWishlistItem = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const itemType = normalizeItemType(req.params.itemType);
    const itemId = parsePositiveInt(req.params.itemId);

    if (!ALLOWED_ITEM_TYPES.has(itemType)) {
      return res.status(400).json({ message: "itemType must be trail, homestay, or guide" });
    }

    if (!itemId) {
      return res.status(400).json({ message: "itemId must be a positive integer" });
    }

    await pool.query(
      `DELETE FROM tourist_wishlists
       WHERE tourist_id = $1 AND item_type = $2 AND item_id = $3`,
      [touristId, itemType, itemId]
    );

    return res.status(200).json({
      message: "Removed from wishlist",
      wishlisted: false,
      item_type: itemType,
      item_id: itemId,
    });
  } catch (err) {
    console.error("Error removing wishlist item:", err);
    return res.status(500).json({ message: "Server error removing wishlist item" });
  }
};
