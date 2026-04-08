import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DOMParser } from "@xmldom/xmldom";
import { gpx as gpxToGeoJSON } from "@tmcw/togeojson";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

const toAbsoluteUploadPath = (uploadPath) => {
  if (!uploadPath) return null;
  return path.join(srcDir, uploadPath.replace(/^\/+/, ""));
};

const safeDeleteUpload = (uploadPath) => {
  const absolutePath = toAbsoluteUploadPath(uploadPath);
  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const parseGpxFileToGeoJson = async (absolutePath) => {
  const gpxText = await fs.promises.readFile(absolutePath, "utf8");
  const xmlDoc = new DOMParser().parseFromString(gpxText, "application/xml");
  const parsed = gpxToGeoJSON(xmlDoc);

  if (!parsed || !Array.isArray(parsed.features) || parsed.features.length === 0) {
    throw new Error("Invalid GPX file: no route features found");
  }

  return parsed;
};

/* =========================
   GET ALL TRAILS (with itineraries & images)
========================= */
export const getAllTrails = async (req, res) => {
  try {
    // Get all trails
    const trailsResult = await pool.query(
      `SELECT t.*, a.full_name AS approved_by_name
       FROM trekking_trails t
       LEFT JOIN admins a ON t.approved_by = a.admin_id
       ORDER BY t.created_at DESC`
    );

    const trails = trailsResult.rows;

    // For each trail, fetch itineraries and images
    for (let trail of trails) {
      const itinerariesResult = await pool.query(
        `SELECT * FROM trail_itineraries
         WHERE trail_id = $1
         ORDER BY day_number ASC`,
        [trail.trail_id]
      );
      trail.itineraries = itinerariesResult.rows;

      const imagesResult = await pool.query(
        `SELECT * FROM trail_images
         WHERE trail_id = $1
         ORDER BY is_primary DESC, uploaded_at ASC`,
        [trail.trail_id]
      );
      trail.images = imagesResult.rows;
    }

    res.status(200).json({ trails });
  } catch (err) {
    console.error("Error fetching trails:", err);
    res.status(500).json({ message: "Server error fetching trails" });
  }
};

/* =========================
   GET SINGLE TRAIL BY ID
========================= */
export const getTrailById = async (req, res) => {
  try {
    const { id } = req.params;

    const trailResult = await pool.query(
      `SELECT t.*, a.full_name AS approved_by_name
       FROM trekking_trails t
       LEFT JOIN admins a ON t.approved_by = a.admin_id
       WHERE t.trail_id = $1`,
      [id]
    );

    if (trailResult.rows.length === 0) {
      return res.status(404).json({ message: "Trail not found" });
    }

    const trail = trailResult.rows[0];

    const itinerariesResult = await pool.query(
      `SELECT * FROM trail_itineraries
       WHERE trail_id = $1
       ORDER BY day_number ASC`,
      [id]
    );
    trail.itineraries = itinerariesResult.rows;

    const imagesResult = await pool.query(
      `SELECT * FROM trail_images
       WHERE trail_id = $1
       ORDER BY is_primary DESC, uploaded_at ASC`,
      [id]
    );
    trail.images = imagesResult.rows;

    res.status(200).json({ trail });
  } catch (err) {
    console.error("Error fetching trail:", err);
    res.status(500).json({ message: "Server error fetching trail" });
  }
};

/* =========================
   CREATE TRAIL (with itineraries & images)
========================= */
export const createTrail = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminId = req.user.user_id;

    const {
      trail_name,
      difficulty_level,
      duration_days,
      max_altitude,
      description,
      region,
      itineraries // JSON string: [{ day_number, title, description, altitude, distance_km, walking_hours }]
    } = req.body;

    // Validate required fields
    if (!trail_name || !difficulty_level || !duration_days || !description || !region) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Missing required trail fields" });
    }

    // Parse itineraries
    let parsedItineraries = [];
    if (itineraries) {
      try {
        parsedItineraries = JSON.parse(itineraries);
      } catch {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid itineraries JSON format" });
      }
    }

    // Handle GPX file path
    let gpxFilePath = null;
    let gpxGeojson = null;
    if (req.files && req.files.gpx_file && req.files.gpx_file.length > 0) {
      gpxFilePath = `/uploads/gpx/${req.files.gpx_file[0].filename}`;
      try {
        const absoluteGpxPath = toAbsoluteUploadPath(gpxFilePath);
        gpxGeojson = await parseGpxFileToGeoJson(absoluteGpxPath);
      } catch (parseErr) {
        safeDeleteUpload(gpxFilePath);
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid GPX file. Please upload a valid GPX track." });
      }
    }

    // Insert trail
    const trailResult = await client.query(
      `INSERT INTO trekking_trails
        (approved_by, trail_name, difficulty_level, duration_days, max_altitude, description, region, gpx_file_path, gpx_geojson)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [adminId, trail_name, difficulty_level, parseInt(duration_days), max_altitude || null, description, region, gpxFilePath, gpxGeojson]
    );

    const trail = trailResult.rows[0];
    const trailId = trail.trail_id;

    // Insert itineraries
    const insertedItineraries = [];
    for (const item of parsedItineraries) {
      const itResult = await client.query(
        `INSERT INTO trail_itineraries
          (trail_id, day_number, title, description, altitude, distance_km, walking_hours)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          trailId,
          item.day_number,
          item.title || null,
          item.description,
          item.altitude || null,
          item.distance_km || null,
          item.walking_hours || null
        ]
      );
      insertedItineraries.push(itResult.rows[0]);
    }

    // Insert images
    const insertedImages = [];
    if (req.files && req.files.images && req.files.images.length > 0) {
      for (let i = 0; i < req.files.images.length; i++) {
        const file = req.files.images[i];
        const isPrimary = i === 0; // First image is primary
        const imgResult = await client.query(
          `INSERT INTO trail_images (trail_id, image_path, is_primary)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [trailId, `/uploads/trails/${file.filename}`, isPrimary]
        );
        insertedImages.push(imgResult.rows[0]);
      }
    }

    await client.query("COMMIT");

    trail.itineraries = insertedItineraries;
    trail.images = insertedImages;

    res.status(201).json({ message: "Trail created successfully", trail });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating trail:", err);
    res.status(500).json({ message: "Server error creating trail" });
  } finally {
    client.release();
  }
};

/* =========================
   UPDATE TRAIL (details + itineraries, optional files)
========================= */
export const updateTrail = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const adminId = req.user.user_id;

    const {
      trail_name,
      difficulty_level,
      duration_days,
      max_altitude,
      description,
      region,
      itineraries,
      removed_image_ids,
      replacement_image_ids
    } = req.body;

    const filesToDelete = [];

    if (!trail_name || !difficulty_level || !duration_days || !description || !region) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Missing required trail fields" });
    }

    const existingTrailResult = await client.query(
      `SELECT * FROM trekking_trails WHERE trail_id = $1`,
      [id]
    );

    if (existingTrailResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Trail not found" });
    }

    let parsedItineraries = [];
    if (itineraries) {
      try {
        parsedItineraries = JSON.parse(itineraries);
      } catch {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid itineraries JSON format" });
      }
    }

    let parsedRemovedImageIds = [];
    if (removed_image_ids) {
      try {
        parsedRemovedImageIds = JSON.parse(removed_image_ids)
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value));
      } catch {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid removed_image_ids format" });
      }
    }

    let parsedReplacementImageIds = [];
    if (replacement_image_ids) {
      try {
        parsedReplacementImageIds = JSON.parse(replacement_image_ids)
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value));
      } catch {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid replacement_image_ids format" });
      }
    }

    let gpxFilePath = existingTrailResult.rows[0].gpx_file_path;
    let gpxGeojson = existingTrailResult.rows[0].gpx_geojson;
    if (req.files && req.files.gpx_file && req.files.gpx_file.length > 0) {
      const newGpxFilePath = `/uploads/gpx/${req.files.gpx_file[0].filename}`;
      try {
        const absoluteGpxPath = toAbsoluteUploadPath(newGpxFilePath);
        gpxGeojson = await parseGpxFileToGeoJson(absoluteGpxPath);
      } catch (parseErr) {
        safeDeleteUpload(newGpxFilePath);
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Invalid GPX file. Please upload a valid GPX track." });
      }

      if (gpxFilePath) {
        filesToDelete.push(gpxFilePath);
      }
      gpxFilePath = newGpxFilePath;
    }

    await client.query(
      `UPDATE trekking_trails
       SET approved_by = $1,
           trail_name = $2,
           difficulty_level = $3,
           duration_days = $4,
           max_altitude = $5,
           description = $6,
           region = $7,
           gpx_file_path = $8,
           gpx_geojson = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE trail_id = $10`,
      [
        adminId,
        trail_name,
        difficulty_level,
        parseInt(duration_days, 10),
        max_altitude || null,
        description,
        region,
        gpxFilePath,
        gpxGeojson,
        id
      ]
    );

    await client.query(`DELETE FROM trail_itineraries WHERE trail_id = $1`, [id]);

    for (const item of parsedItineraries) {
      await client.query(
        `INSERT INTO trail_itineraries
         (trail_id, day_number, title, description, altitude, distance_km, walking_hours)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          item.day_number,
          item.title || null,
          item.description,
          item.altitude || null,
          item.distance_km || null,
          item.walking_hours || null
        ]
      );
    }

    if (parsedRemovedImageIds.length > 0) {
      const existingImagesToDelete = await client.query(
        `SELECT image_id, image_path
         FROM trail_images
         WHERE trail_id = $1 AND image_id = ANY($2::int[])`,
        [id, parsedRemovedImageIds]
      );

      for (const row of existingImagesToDelete.rows) {
        filesToDelete.push(row.image_path);
      }

      await client.query(
        `DELETE FROM trail_images
         WHERE trail_id = $1 AND image_id = ANY($2::int[])`,
        [id, parsedRemovedImageIds]
      );
    }

    const replacementFiles = (req.files && req.files.replacement_images) || [];
    if (replacementFiles.length > 0 || parsedReplacementImageIds.length > 0) {
      if (replacementFiles.length !== parsedReplacementImageIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Replacement image count mismatch" });
      }

      const existingReplacementTargets = await client.query(
        `SELECT image_id, image_path
         FROM trail_images
         WHERE trail_id = $1 AND image_id = ANY($2::int[])`,
        [id, parsedReplacementImageIds]
      );

      const targetMap = new Map(existingReplacementTargets.rows.map((row) => [row.image_id, row]));

      for (let index = 0; index < parsedReplacementImageIds.length; index++) {
        const imageId = parsedReplacementImageIds[index];
        const target = targetMap.get(imageId);

        if (!target) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `Invalid replacement image id: ${imageId}` });
        }

        const replacementFile = replacementFiles[index];
        const newPath = `/uploads/trails/${replacementFile.filename}`;

        await client.query(
          `UPDATE trail_images
           SET image_path = $1
           WHERE trail_id = $2 AND image_id = $3`,
          [newPath, id, imageId]
        );

        if (target.image_path) {
          filesToDelete.push(target.image_path);
        }
      }
    }

    if (req.files && req.files.images && req.files.images.length > 0) {
      const existingPrimaryResult = await client.query(
        `SELECT image_id FROM trail_images WHERE trail_id = $1 AND is_primary = TRUE LIMIT 1`,
        [id]
      );

      let hasPrimaryImage = existingPrimaryResult.rows.length > 0;

      for (let i = 0; i < req.files.images.length; i++) {
        const file = req.files.images[i];
        const isPrimary = !hasPrimaryImage && i === 0;

        await client.query(
          `INSERT INTO trail_images (trail_id, image_path, is_primary)
           VALUES ($1, $2, $3)`,
          [id, `/uploads/trails/${file.filename}`, isPrimary]
        );

        if (isPrimary) {
          hasPrimaryImage = true;
        }
      }
    }

    const primaryCheckResult = await client.query(
      `SELECT image_id FROM trail_images WHERE trail_id = $1 AND is_primary = TRUE LIMIT 1`,
      [id]
    );

    if (primaryCheckResult.rows.length === 0) {
      const firstImageResult = await client.query(
        `SELECT image_id FROM trail_images WHERE trail_id = $1 ORDER BY uploaded_at ASC LIMIT 1`,
        [id]
      );

      if (firstImageResult.rows.length > 0) {
        await client.query(`UPDATE trail_images SET is_primary = TRUE WHERE image_id = $1`, [
          firstImageResult.rows[0].image_id
        ]);
      }
    }

    await client.query("COMMIT");

    for (const relativePath of filesToDelete) {
      safeDeleteUpload(relativePath);
    }

    const updatedTrailResult = await pool.query(
      `SELECT t.*, a.full_name AS approved_by_name
       FROM trekking_trails t
       LEFT JOIN admins a ON t.approved_by = a.admin_id
       WHERE t.trail_id = $1`,
      [id]
    );

    const updatedTrail = updatedTrailResult.rows[0];

    const itinerariesResult = await pool.query(
      `SELECT * FROM trail_itineraries WHERE trail_id = $1 ORDER BY day_number ASC`,
      [id]
    );
    updatedTrail.itineraries = itinerariesResult.rows;

    const imagesResult = await pool.query(
      `SELECT * FROM trail_images WHERE trail_id = $1 ORDER BY is_primary DESC, uploaded_at ASC`,
      [id]
    );
    updatedTrail.images = imagesResult.rows;

    res.status(200).json({ message: "Trail updated successfully", trail: updatedTrail });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating trail:", err);
    res.status(500).json({ message: "Server error updating trail" });
  } finally {
    client.release();
  }
};

/* =========================
   DELETE TRAIL
========================= */
export const deleteTrail = async (req, res) => {
  try {
    const { id } = req.params;

    // Get trail images and gpx before deleting (for file cleanup)
    const imagesResult = await pool.query(
      `SELECT image_path FROM trail_images WHERE trail_id = $1`,
      [id]
    );
    const trailResult = await pool.query(
      `SELECT gpx_file_path FROM trekking_trails WHERE trail_id = $1`,
      [id]
    );

    if (trailResult.rows.length === 0) {
      return res.status(404).json({ message: "Trail not found" });
    }

    // Delete trail (CASCADE will handle itineraries and images rows)
    await pool.query(`DELETE FROM trekking_trails WHERE trail_id = $1`, [id]);

    // Cleanup uploaded files
    for (const img of imagesResult.rows) {
      safeDeleteUpload(img.image_path);
    }

    const gpxPath = trailResult.rows[0].gpx_file_path;
    if (gpxPath) {
      safeDeleteUpload(gpxPath);
    }

    res.status(200).json({ message: "Trail deleted successfully" });
  } catch (err) {
    console.error("Error deleting trail:", err);
    res.status(500).json({ message: "Server error deleting trail" });
  }
};

/* =========================
   PUBLIC: GET ALL TRAILS (no auth required)
========================= */
export const getPublicTrails = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const region = String(req.query.region || "").trim();
    const difficulty = String(req.query.difficulty || "").trim();
    const maxDurationRaw = Number.parseInt(req.query.maxDuration, 10);
    const maxDuration = Number.isFinite(maxDurationRaw) && maxDurationRaw > 0 ? maxDurationRaw : null;
    const sort = String(req.query.sort || "recent").trim();

    const whereClauses = [];
    const values = [];

    if (q) {
      values.push(`%${q}%`);
      const idx = values.length;
      whereClauses.push(`(
        t.trail_name ILIKE $${idx}
        OR t.description ILIKE $${idx}
        OR t.region ILIKE $${idx}
        OR t.difficulty_level ILIKE $${idx}
      )`);
    }

    if (region) {
      values.push(region);
      const idx = values.length;
      whereClauses.push(`LOWER(t.region) = LOWER($${idx})`);
    }

    if (difficulty) {
      values.push(difficulty);
      const idx = values.length;
      whereClauses.push(`LOWER(t.difficulty_level) = LOWER($${idx})`);
    }

    if (maxDuration) {
      values.push(maxDuration);
      const idx = values.length;
      whereClauses.push(`t.duration_days <= $${idx}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sortMap = {
      recent: "t.created_at DESC",
      name_asc: "t.trail_name ASC",
      duration_asc: "t.duration_days ASC, t.created_at DESC",
      altitude_desc: "t.max_altitude DESC NULLS LAST, t.created_at DESC"
    };
    const orderSql = sortMap[sort] || sortMap.recent;

    const trailsResult = await pool.query(
      `SELECT t.trail_id, t.trail_name, t.difficulty_level, t.duration_days,
              t.max_altitude, t.description, t.region, t.created_at
       FROM trekking_trails t
       ${whereSql}
       ORDER BY ${orderSql}`,
      values
    );

    const trails = trailsResult.rows;

    for (let trail of trails) {
      const imagesResult = await pool.query(
        `SELECT image_id, image_path, is_primary FROM trail_images
         WHERE trail_id = $1
         ORDER BY is_primary DESC, uploaded_at ASC`,
        [trail.trail_id]
      );
      trail.images = imagesResult.rows;
    }

    const [regionsResult, difficultiesResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT region
         FROM trekking_trails
         WHERE region IS NOT NULL AND TRIM(region) <> ''
         ORDER BY region ASC`
      ),
      pool.query(
        `SELECT DISTINCT difficulty_level
         FROM trekking_trails
         WHERE difficulty_level IS NOT NULL AND TRIM(difficulty_level) <> ''
         ORDER BY difficulty_level ASC`
      )
    ]);

    const filters = {
      regions: regionsResult.rows.map((row) => row.region),
      difficulties: difficultiesResult.rows.map((row) => row.difficulty_level)
    };

    res.status(200).json({ trails, filters });
  } catch (err) {
    console.error("Error fetching public trails:", err);
    res.status(500).json({ message: "Server error fetching trails" });
  }
};

/* =========================
   PUBLIC: GET SINGLE TRAIL (no auth required)
========================= */
export const getPublicTrailById = async (req, res) => {
  try {
    const { id } = req.params;

    const trailResult = await pool.query(
      `SELECT t.trail_id, t.trail_name, t.difficulty_level, t.duration_days,
              t.max_altitude, t.description, t.region, t.gpx_file_path, t.gpx_geojson, t.created_at
       FROM trekking_trails t
       WHERE t.trail_id = $1`,
      [id]
    );

    if (trailResult.rows.length === 0) {
      return res.status(404).json({ message: "Trail not found" });
    }

    const trail = trailResult.rows[0];

    const itinerariesResult = await pool.query(
      `SELECT * FROM trail_itineraries
       WHERE trail_id = $1
       ORDER BY day_number ASC`,
      [id]
    );
    trail.itineraries = itinerariesResult.rows;

    const imagesResult = await pool.query(
      `SELECT image_id, image_path, is_primary FROM trail_images
       WHERE trail_id = $1
       ORDER BY is_primary DESC, uploaded_at ASC`,
      [id]
    );
    trail.images = imagesResult.rows;

    res.status(200).json({ trail });
  } catch (err) {
    console.error("Error fetching public trail:", err);
    res.status(500).json({ message: "Server error fetching trail" });
  }
};
