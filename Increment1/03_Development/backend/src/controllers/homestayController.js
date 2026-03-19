import pool from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "..");

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
    } = req.body;

    // Validate required fields
    if (!trail_id || !name || !location || !price_per_night || !capacity) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Trail, name, location, price per night, and capacity are required",
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
        (host_id, trail_id, name, location, price_per_night, capacity, description, latitude, longitude, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        hostId,
        trail_id,
        name,
        location,
        parseFloat(price_per_night),
        parseInt(capacity),
        description || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        contact_phone || null,
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
    } = req.body;

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
        verified_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $10 AND host_id = $11`,
      [
        trail_id || null,
        name || null,
        location || null,
        price_per_night ? parseFloat(price_per_night) : null,
        capacity ? parseInt(capacity) : null,
        description || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        contact_phone || null,
        id,
        hostId,
      ]
    );

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
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
      `SELECT image_path FROM homestay_images WHERE image_id = $1 AND homestay_id = $2`,
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

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("Error deleting homestay image:", err);
    res.status(500).json({ message: "Server error deleting image" });
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
   PUBLIC: GET APPROVED HOMESTAYS BY TRAIL
========================= */
export const getPublicHomestaysByTrail = async (req, res) => {
  try {
    const { trailId } = req.params;
    const result = await pool.query(
      `SELECT homestay_id, name, location, price_per_night, capacity,
              description, contact_phone, latitude, longitude, is_active
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
    const { id } = req.params;
    const { verified_status } = req.body;

    if (!["approved", "rejected"].includes(verified_status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    // When approving, also ensure is_active = true; when rejecting, deactivate
    const result = await pool.query(
      `UPDATE homestays
       SET verified_status = $1,
           is_active = CASE WHEN $1 = 'approved' THEN true ELSE false END,
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $2
       RETURNING *`,
      [verified_status, id]
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
