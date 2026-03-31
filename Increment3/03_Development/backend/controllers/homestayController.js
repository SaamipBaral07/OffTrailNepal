import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

const parseCoordinate = (rawValue, fieldName, min, max) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { value: null, error: null };
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${fieldName} must be a valid number` };
  }

  if (parsed < min || parsed > max) {
    return { value: null, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { value: parsed, error: null };
};

const parsePositiveInt = (rawValue, fieldName) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { value: null, error: null };
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: null, error: `${fieldName} must be a non-negative integer` };
  }

  return { value: parsed, error: null };
};

const normalizeAmenities = (rawAmenities) => {
  if (Array.isArray(rawAmenities)) {
    return rawAmenities
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof rawAmenities === "string") {
    return rawAmenities
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeGoogleMapLink = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  let candidate = value;
  const iframeSrcMatch = value.match(/src\s*=\s*['\"]([^'\"]+)['\"]/i);
  if (iframeSrcMatch?.[1]) {
    candidate = iframeSrcMatch[1];
  }

  try {
    const parsedUrl = new URL(candidate);
    const host = parsedUrl.hostname.toLowerCase();
    const isGoogleMapsHost = host.includes("google.com") || host.includes("goo.gl") || host.includes("googleusercontent.com");
    if (!isGoogleMapsHost) return null;
    return parsedUrl.toString();
  } catch {
    return null;
  }
};

/* =========================
   GET ALL TRAILS (for dropdown — public trail list)
========================= */
export const getTrailsForHost = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT trail_id, trail_name, region, difficulty_level, duration_days
       FROM trekking_trails
       ORDER BY trail_name ASC`
    );
    res.status(200).json({ trails: result.rows });
  } catch (err) {
    console.error("Error fetching trails for host:", err);
    res.status(500).json({ message: "Server error fetching trails" });
  }
};

/* =========================
   GET HOST'S HOMESTAYS
========================= */
export const getMyHomestays = async (req, res) => {
  try {
    const hostId = req.user.user_id;

    const homestaysResult = await pool.query(
      `SELECT h.*, t.trail_name, t.region
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE h.host_id = $1
       ORDER BY h.created_at DESC`,
      [hostId]
    );

    const homestays = homestaysResult.rows;

    // Fetch images for each homestay
    for (let homestay of homestays) {
      const imagesResult = await pool.query(
        `SELECT * FROM homestay_images
         WHERE homestay_id = $1
         ORDER BY is_primary DESC, uploaded_at ASC`,
        [homestay.homestay_id]
      );
      homestay.images = imagesResult.rows;
    }

    res.status(200).json({ homestays });
  } catch (err) {
    console.error("Error fetching homestays:", err);
    res.status(500).json({ message: "Server error fetching homestays" });
  }
};

/* =========================
   GET SINGLE HOMESTAY BY ID (owner only)
========================= */
export const getHomestayById = async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.user.user_id;

    const result = await pool.query(
      `SELECT h.*, t.trail_name, t.region
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE h.homestay_id = $1 AND h.host_id = $2`,
      [id, hostId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Homestay not found" });
    }

    const homestay = result.rows[0];

    const imagesResult = await pool.query(
      `SELECT * FROM homestay_images
       WHERE homestay_id = $1
       ORDER BY is_primary DESC, uploaded_at ASC`,
      [id]
    );
    homestay.images = imagesResult.rows;

    res.status(200).json({ homestay });
  } catch (err) {
    console.error("Error fetching homestay:", err);
    res.status(500).json({ message: "Server error fetching homestay" });
  }
};

/* =========================
   CREATE HOMESTAY
========================= */
export const createHomestay = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hostId = req.user.user_id;

    const {
      trail_id,
      name,
      location,
      price_per_night,
      capacity,
      description,
      latitude,
      longitude,
      contact_phone,
      amenities,
      total_rooms,
      available_rooms,
      google_map_iframe_link,
    } = req.body;

    const latitudeParsed = parseCoordinate(latitude, "latitude", -90, 90);
    const longitudeParsed = parseCoordinate(longitude, "longitude", -180, 180);

    if (latitudeParsed.error || longitudeParsed.error) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: latitudeParsed.error || longitudeParsed.error,
      });
    }

    if ((latitudeParsed.value === null) !== (longitudeParsed.value === null)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "latitude and longitude must both be provided together",
      });
    }

    // Validate required fields
    if (!trail_id || !name || !location || !price_per_night || !capacity) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Trail, name, location, price per night, and capacity are required",
      });
    }

    const totalRoomsParsed = parsePositiveInt(total_rooms, "total_rooms");
    const availableRoomsParsed = parsePositiveInt(available_rooms, "available_rooms");
    if (totalRoomsParsed.error || availableRoomsParsed.error) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: totalRoomsParsed.error || availableRoomsParsed.error,
      });
    }

    const totalRoomsValue = totalRoomsParsed.value ?? 1;
    const availableRoomsValue = availableRoomsParsed.value ?? totalRoomsValue;
    if (availableRoomsValue > totalRoomsValue) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "available_rooms cannot be greater than total_rooms",
      });
    }

    const normalizedAmenities = normalizeAmenities(amenities);
    const normalizedMapLink = normalizeGoogleMapLink(google_map_iframe_link);
    if (google_map_iframe_link && !normalizedMapLink) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "google_map_iframe_link must be a valid Google Maps URL or iframe embed",
      });
    }

    // Verify trail exists
    const trailCheck = await client.query(
      `SELECT trail_id FROM trekking_trails WHERE trail_id = $1`,
      [trail_id]
    );
    if (trailCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Selected trail does not exist" });
    }

    // Insert homestay (verified_status defaults to 'pending')
    const homestayResult = await client.query(
      `INSERT INTO homestays
        (host_id, trail_id, name, location, price_per_night, capacity, description, latitude, longitude, contact_phone, amenities, total_rooms, available_rooms, google_map_iframe_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        hostId,
        trail_id,
        name,
        location,
        parseFloat(price_per_night),
        parseInt(capacity),
        description || null,
        latitudeParsed.value,
        longitudeParsed.value,
        contact_phone || null,
        normalizedAmenities,
        totalRoomsValue,
        availableRoomsValue,
        normalizedMapLink,
      ]
    );

    const homestay = homestayResult.rows[0];

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imagePath = `/uploads/homestays/${file.filename}`;
        const isPrimary = i === 0; // First image is primary

        await client.query(
          `INSERT INTO homestay_images (homestay_id, image_path, is_primary)
           VALUES ($1, $2, $3)`,
          [homestay.homestay_id, imagePath, isPrimary]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch the complete homestay with images
    const fullHomestay = await pool.query(
      `SELECT h.*, t.trail_name, t.region
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE h.homestay_id = $1`,
      [homestay.homestay_id]
    );

    const imagesResult = await pool.query(
      `SELECT * FROM homestay_images WHERE homestay_id = $1 ORDER BY is_primary DESC`,
      [homestay.homestay_id]
    );

    const result = fullHomestay.rows[0];
    result.images = imagesResult.rows;

    res.status(201).json({
      message: "Homestay listing created successfully! It will be reviewed by admin.",
      homestay: result,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating homestay:", err);
    res.status(500).json({ message: "Server error creating homestay" });
  } finally {
    client.release();
  }
};

/* =========================
   UPDATE HOMESTAY (owner only, resets to pending)
========================= */
export const updateHomestay = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const hostId = req.user.user_id;

    // Check ownership
    const ownership = await client.query(
      `SELECT * FROM homestays WHERE homestay_id = $1 AND host_id = $2`,
      [id, hostId]
    );

    if (ownership.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }
    const existingHomestay = ownership.rows[0];

    const {
      trail_id,
      name,
      location,
      price_per_night,
      capacity,
      description,
      latitude,
      longitude,
      contact_phone,
      amenities,
      total_rooms,
      available_rooms,
      google_map_iframe_link,
      replace_existing_images,
    } = req.body;

    const shouldReplaceExistingImages = String(replace_existing_images || "").toLowerCase() === "true";

    const hasLatitude = Object.prototype.hasOwnProperty.call(req.body, "latitude");
    const hasLongitude = Object.prototype.hasOwnProperty.call(req.body, "longitude");

    if (hasLatitude !== hasLongitude) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "latitude and longitude must both be provided together",
      });
    }

    let latitudeValue = existingHomestay.latitude;
    let longitudeValue = existingHomestay.longitude;
    let totalRoomsValue = existingHomestay.total_rooms ?? 1;
    let availableRoomsValue = existingHomestay.available_rooms ?? existingHomestay.total_rooms ?? 1;
    let amenitiesValue = existingHomestay.amenities ?? [];
    let mapLinkValue = existingHomestay.google_map_iframe_link ?? null;

    if (hasLatitude && hasLongitude) {
      const latitudeParsed = parseCoordinate(latitude, "latitude", -90, 90);
      const longitudeParsed = parseCoordinate(longitude, "longitude", -180, 180);

      if (latitudeParsed.error || longitudeParsed.error) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: latitudeParsed.error || longitudeParsed.error,
        });
      }

      if ((latitudeParsed.value === null) !== (longitudeParsed.value === null)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "latitude and longitude must both be provided together",
        });
      }

      latitudeValue = latitudeParsed.value;
      longitudeValue = longitudeParsed.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "total_rooms")) {
      const totalRoomsParsed = parsePositiveInt(total_rooms, "total_rooms");
      if (totalRoomsParsed.error || totalRoomsParsed.value === null || totalRoomsParsed.value < 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: totalRoomsParsed.error || "total_rooms must be at least 1",
        });
      }
      totalRoomsValue = totalRoomsParsed.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "available_rooms")) {
      const availableRoomsParsed = parsePositiveInt(available_rooms, "available_rooms");
      if (availableRoomsParsed.error || availableRoomsParsed.value === null) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: availableRoomsParsed.error || "available_rooms is invalid",
        });
      }
      availableRoomsValue = availableRoomsParsed.value;
    }

    if (availableRoomsValue > totalRoomsValue) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "available_rooms cannot be greater than total_rooms",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "amenities")) {
      amenitiesValue = normalizeAmenities(amenities);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "google_map_iframe_link")) {
      if (!String(google_map_iframe_link || "").trim()) {
        mapLinkValue = null;
      } else {
        const normalizedMapLink = normalizeGoogleMapLink(google_map_iframe_link);
        if (!normalizedMapLink) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "google_map_iframe_link must be a valid Google Maps URL or iframe embed",
          });
        }
        mapLinkValue = normalizedMapLink;
      }
    }

    // Update homestay (reset verified_status to pending on edit)
    await client.query(
      `UPDATE homestays SET
        trail_id = COALESCE($1, trail_id),
        name = COALESCE($2, name),
        location = COALESCE($3, location),
        price_per_night = COALESCE($4, price_per_night),
        capacity = COALESCE($5, capacity),
        description = COALESCE($6, description),
        latitude = $7,
        longitude = $8,
        contact_phone = $9,
        amenities = $10,
        total_rooms = $11,
        available_rooms = $12,
        google_map_iframe_link = $13,
        verified_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $14 AND host_id = $15`,
      [
        trail_id || null,
        name || null,
        location || null,
        price_per_night ? parseFloat(price_per_night) : null,
        capacity ? parseInt(capacity) : null,
        description || null,
        latitudeValue,
        longitudeValue,
        contact_phone || null,
        amenitiesValue,
        totalRoomsValue,
        availableRoomsValue,
        mapLinkValue,
        id,
        hostId,
      ]
    );

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      if (String(req.body?.replace_existing_images || "").toLowerCase() === "true") {
        const existingImagesToDelete = await client.query(
          `SELECT image_path FROM homestay_images WHERE homestay_id = $1`,
          [id]
        );

        for (const img of existingImagesToDelete.rows) {
          const filePath = path.join(srcDir, img.image_path.replace(/^\/+/, ""));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        await client.query(`DELETE FROM homestay_images WHERE homestay_id = $1`, [id]);
      }

      // Check if there are existing images
      const existingImages = await client.query(
        `SELECT COUNT(*) FROM homestay_images WHERE homestay_id = $1`,
        [id]
      );
      const hasExisting = parseInt(existingImages.rows[0].count) > 0;

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const imagePath = `/uploads/homestays/${file.filename}`;
        const isPrimary = !hasExisting && i === 0;

        await client.query(
          `INSERT INTO homestay_images (homestay_id, image_path, is_primary)
           VALUES ($1, $2, $3)`,
          [id, imagePath, isPrimary]
        );
      }
    }

    await client.query("COMMIT");

    // Return updated homestay
    const updatedResult = await pool.query(
      `SELECT h.*, t.trail_name, t.region
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE h.homestay_id = $1`,
      [id]
    );

    const imagesResult = await pool.query(
      `SELECT * FROM homestay_images WHERE homestay_id = $1 ORDER BY is_primary DESC`,
      [id]
    );

    const homestay = updatedResult.rows[0];
    homestay.images = imagesResult.rows;

    res.status(200).json({
      message: "Homestay updated successfully. Status reset to pending for review.",
      homestay,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating homestay:", err);
    res.status(500).json({ message: "Server error updating homestay" });
  } finally {
    client.release();
  }
};

/* =========================
   DELETE HOMESTAY (owner only)
========================= */
export const deleteHomestay = async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.user.user_id;

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM homestays WHERE homestay_id = $1 AND host_id = $2`,
      [id, hostId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }

    // Get images to delete from filesystem
    const images = await pool.query(
      `SELECT image_path FROM homestay_images WHERE homestay_id = $1`,
      [id]
    );

    // Delete image files
    for (const img of images.rows) {
      const filePath = path.join(srcDir, img.image_path.replace(/^\/+/, ""));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete homestay (cascade will remove images from DB)
    await pool.query(`DELETE FROM homestays WHERE homestay_id = $1 AND host_id = $2`, [
      id,
      hostId,
    ]);

    res.status(200).json({ message: "Homestay deleted successfully" });
  } catch (err) {
    console.error("Error deleting homestay:", err);
    res.status(500).json({ message: "Server error deleting homestay" });
  }
};

/* =========================
   DELETE HOMESTAY IMAGE
========================= */
export const deleteHomestayImage = async (req, res) => {
  try {
    const { homestayId, imageId } = req.params;
    const hostId = req.user.user_id;

    // Check ownership
    const ownership = await pool.query(
      `SELECT * FROM homestays WHERE homestay_id = $1 AND host_id = $2`,
      [homestayId, hostId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }

    // Get image path
    const imageResult = await pool.query(
      `SELECT image_path, is_primary FROM homestay_images WHERE image_id = $1 AND homestay_id = $2`,
      [imageId, homestayId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Delete file
    const filePath = path.join(srcDir, imageResult.rows[0].image_path.replace(/^\/+/, ""));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await pool.query(`DELETE FROM homestay_images WHERE image_id = $1`, [imageId]);

    if (imageResult.rows[0].is_primary) {
      const fallbackImage = await pool.query(
        `SELECT image_id
         FROM homestay_images
         WHERE homestay_id = $1
         ORDER BY uploaded_at ASC
         LIMIT 1`,
        [homestayId]
      );

      if (fallbackImage.rows.length > 0) {
        await pool.query(
          `UPDATE homestay_images
           SET is_primary = true
           WHERE image_id = $1`,
          [fallbackImage.rows[0].image_id]
        );
      }
    }

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("Error deleting homestay image:", err);
    res.status(500).json({ message: "Server error deleting image" });
  }
};

/* =========================
   SET PRIMARY HOMESTAY IMAGE
========================= */
export const setHomestayPrimaryImage = async (req, res) => {
  const client = await pool.connect();

  try {
    const homestayId = Number.parseInt(req.params.homestayId, 10);
    const imageId = Number.parseInt(req.params.imageId, 10);
    const hostId = req.user.user_id;

    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    if (!Number.isInteger(imageId) || imageId <= 0) {
      return res.status(400).json({ message: "Invalid image id" });
    }

    await client.query("BEGIN");

    const ownership = await client.query(
      `SELECT homestay_id FROM homestays WHERE homestay_id = $1 AND host_id = $2`,
      [homestayId, hostId]
    );

    if (ownership.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }

    const targetImage = await client.query(
      `SELECT image_id FROM homestay_images WHERE image_id = $1 AND homestay_id = $2`,
      [imageId, homestayId]
    );

    if (targetImage.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Image not found" });
    }

    await client.query(
      `UPDATE homestay_images SET is_primary = false WHERE homestay_id = $1`,
      [homestayId]
    );

    await client.query(
      `UPDATE homestay_images SET is_primary = true WHERE image_id = $1`,
      [imageId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Primary image updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error setting primary homestay image:", err);
    return res.status(500).json({ message: "Server error setting primary image" });
  } finally {
    client.release();
  }
};

/* =========================
   TOGGLE HOMESTAY ACTIVE STATUS
========================= */
export const toggleHomestayActive = async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.user.user_id;

    const result = await pool.query(
      `UPDATE homestays SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $1 AND host_id = $2
       RETURNING *`,
      [id, hostId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }

    res.status(200).json({
      message: `Homestay ${result.rows[0].is_active ? "activated" : "deactivated"} successfully`,
      homestay: result.rows[0],
    });
  } catch (err) {
    console.error("Error toggling homestay status:", err);
    res.status(500).json({ message: "Server error toggling status" });
  }
};

/* =========================
   UPDATE AVAILABLE ROOMS (owner only)
========================= */
export const updateHomestayAvailableRooms = async (req, res) => {
  try {
    const homestayId = Number.parseInt(req.params.id, 10);
    const hostId = req.user.user_id;
    const { available_rooms, total_rooms } = req.body;

    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    const availableParsed = parsePositiveInt(available_rooms, "available_rooms");
    const totalParsed = parsePositiveInt(total_rooms, "total_rooms");
    if (availableParsed.error || availableParsed.value === null) {
      return res.status(400).json({
        message: availableParsed.error || "available_rooms is required",
      });
    }

    if (total_rooms !== undefined && (totalParsed.error || totalParsed.value === null || totalParsed.value < 1)) {
      return res.status(400).json({
        message: totalParsed.error || "total_rooms must be at least 1",
      });
    }

    const ownership = await pool.query(
      `SELECT homestay_id, total_rooms FROM homestays WHERE homestay_id = $1 AND host_id = $2`,
      [homestayId, hostId]
    );

    if (!ownership.rows.length) {
      return res.status(404).json({ message: "Homestay not found or not owned by you" });
    }

    const totalRooms = totalParsed.value ?? ownership.rows[0].total_rooms ?? 0;
    if (availableParsed.value > totalRooms) {
      return res.status(400).json({ message: "available_rooms cannot be greater than total_rooms" });
    }

    const result = await pool.query(
      `UPDATE homestays
       SET available_rooms = $1,
           total_rooms = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $3 AND host_id = $4
       RETURNING *`,
      [availableParsed.value, totalRooms, homestayId, hostId]
    );

    res.status(200).json({
      message: "Available rooms updated successfully",
      homestay: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating available rooms:", err);
    res.status(500).json({ message: "Server error updating available rooms" });
  }
};

/* =========================
   PUBLIC: GET HOMESTAY DETAIL BY ID
========================= */
export const getPublicHomestayById = async (req, res) => {
  try {
    const homestayId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    const result = await pool.query(
      `SELECT h.*, t.trail_name, t.region, t.trail_id
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       WHERE h.homestay_id = $1
         AND h.verified_status = 'approved'
         AND h.is_active = true`,
      [homestayId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Homestay not found" });
    }

    const homestay = result.rows[0];
    const imagesResult = await pool.query(
      `SELECT image_id, image_path, is_primary
       FROM homestay_images
       WHERE homestay_id = $1
       ORDER BY is_primary DESC, uploaded_at ASC`,
      [homestayId]
    );
    homestay.images = imagesResult.rows;

    res.status(200).json({ homestay });
  } catch (err) {
    console.error("Error fetching public homestay detail:", err);
    res.status(500).json({ message: "Server error fetching homestay detail" });
  }
};

/* =========================
   PUBLIC: GET APPROVED HOMESTAYS BY TRAIL
========================= */
export const getPublicHomestaysByTrail = async (req, res) => {
  try {
    const { trailId } = req.params;
    const result = await pool.query(
      `SELECT homestay_id, name, location, price_per_night, capacity,
              description, contact_phone, latitude, longitude, is_active,
              amenities, total_rooms, available_rooms, google_map_iframe_link
       FROM homestays
       WHERE trail_id = $1
         AND verified_status = 'approved'
         AND is_active = true
       ORDER BY price_per_night ASC`,
      [trailId]
    );
    const homestays = result.rows;
    for (let homestay of homestays) {
      const imagesResult = await pool.query(
        `SELECT image_id, image_path, is_primary
         FROM homestay_images
         WHERE homestay_id = $1
         ORDER BY is_primary DESC, uploaded_at ASC`,
        [homestay.homestay_id]
      );
      homestay.images = imagesResult.rows;
    }
    res.status(200).json({ homestays });
  } catch (err) {
    console.error("Error fetching public homestays:", err);
    res.status(500).json({ message: "Server error fetching homestays" });
  }
};

/* =========================
   ADMIN: GET ALL HOMESTAYS (for approval)
========================= */
export const getAllHomestaysForAdmin = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.*, t.trail_name, t.region, ho.full_name AS host_name, ho.email AS host_email, ho.phone AS host_phone
       FROM homestays h
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       JOIN hosts ho ON h.host_id = ho.host_id
       ORDER BY 
         CASE h.verified_status 
           WHEN 'pending' THEN 0 
           WHEN 'approved' THEN 1 
           WHEN 'rejected' THEN 2 
         END,
         h.created_at DESC`
    );

    const homestays = result.rows;

    for (let homestay of homestays) {
      const imagesResult = await pool.query(
        `SELECT * FROM homestay_images WHERE homestay_id = $1 ORDER BY is_primary DESC`,
        [homestay.homestay_id]
      );
      homestay.images = imagesResult.rows;
    }

    res.status(200).json({ homestays });
  } catch (err) {
    console.error("Error fetching homestays for admin:", err);
    res.status(500).json({ message: "Server error fetching homestays" });
  }
};

/* =========================
   ADMIN: APPROVE / REJECT HOMESTAY
========================= */
export const updateHomestayStatus = async (req, res) => {
  try {
    const homestayId = Number.parseInt(req.params.id, 10);
    const { verified_status } = req.body;

    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    if (!["approved", "rejected"].includes(verified_status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    // Derive activation in JS to avoid PostgreSQL inferring conflicting types for one placeholder.
    const isActive = verified_status === "approved";

    // When approving, also ensure is_active = true; when rejecting, deactivate
    const result = await pool.query(
      `UPDATE homestays
       SET verified_status = $1::varchar,
           is_active = $2::boolean,
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $3
       RETURNING *`,
      [verified_status, isActive, homestayId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Homestay not found" });
    }

    res.status(200).json({
      message: `Homestay ${verified_status} successfully`,
      homestay: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating homestay status:", err);
    res.status(500).json({ message: "Server error updating status" });
  }
};
