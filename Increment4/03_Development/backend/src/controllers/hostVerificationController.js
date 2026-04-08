import pool from "../config/db.js";

const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export const getMyHostVerificationStatus = async (req, res) => {
  try {
    const hostId = req.user.user_id;

    const result = await pool.query(
      `SELECT
         hv.id,
         hv.host_id,
         hv.citizenship_doc_path,
         hv.verification_status,
         hv.rejection_reason,
         hv.reviewed_by_admin_id,
         hv.reviewed_at,
         hv.created_at,
         hv.updated_at
       FROM host_verifications hv
       WHERE hv.host_id = $1`,
      [hostId]
    );

    res.status(200).json({
      verification: result.rows[0] || null,
    });
  } catch (err) {
    console.error("Error fetching host verification status:", err);
    res.status(500).json({ message: "Server error fetching host verification status" });
  }
};

export const submitHostVerificationDocs = async (req, res) => {
  try {
    const hostId = req.user.user_id;
    const files = req.files || {};
    const citizenshipFile = files.citizenship_image?.[0];

    const existingResult = await pool.query(
      `SELECT id, citizenship_doc_path
       FROM host_verifications
       WHERE host_id = $1`,
      [hostId]
    );

    const existing = existingResult.rows[0] || null;
    const citizenshipPath = citizenshipFile
      ? `/uploads/host-verifications/${citizenshipFile.filename}`
      : existing?.citizenship_doc_path || null;

    if (!citizenshipPath) {
      return res.status(400).json({
        message: "citizenship_image is required",
      });
    }

    const upsertResult = await pool.query(
      `INSERT INTO host_verifications
         (host_id, citizenship_doc_path, verification_status, rejection_reason, reviewed_by_admin_id, reviewed_at)
       VALUES ($1, $2, 'pending', NULL, NULL, NULL)
       ON CONFLICT (host_id)
       DO UPDATE SET
         citizenship_doc_path = EXCLUDED.citizenship_doc_path,
         verification_status = 'pending',
         rejection_reason = NULL,
         reviewed_by_admin_id = NULL,
         reviewed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [hostId, citizenshipPath]
    );

    res.status(200).json({
      message: "Host verification document submitted. Waiting for admin approval.",
      verification: upsertResult.rows[0],
    });
  } catch (err) {
    console.error("Error submitting host verification docs:", err);
    res.status(500).json({ message: "Server error submitting host verification documents" });
  }
};

export const getAllHostVerificationsForAdmin = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         h.host_id,
         h.full_name,
         h.email,
         h.phone,
         h.address,
         h.pan_number,
         h.bank_name,
         h.bank_account_name,
         h.bank_account_number,
         h.created_at AS host_created_at,
         COALESCE(hv.verification_status, 'not_submitted') AS verification_status,
         hv.citizenship_doc_path,
         hv.rejection_reason,
         hv.reviewed_at,
         hv.updated_at
       FROM hosts h
       LEFT JOIN host_verifications hv ON hv.host_id = h.host_id
       ORDER BY
         CASE COALESCE(hv.verification_status, 'not_submitted')
           WHEN 'pending' THEN 0
           WHEN 'rejected' THEN 1
           WHEN 'approved' THEN 2
           ELSE 3
         END,
         h.created_at DESC`
    );

    res.status(200).json({
      hosts: result.rows,
    });
  } catch (err) {
    console.error("Error fetching host verifications for admin:", err);
    res.status(500).json({ message: "Server error fetching host verifications" });
  }
};

export const updateHostVerificationStatus = async (req, res) => {
  try {
    const hostId = Number.parseInt(req.params.hostId, 10);
    const { verification_status, rejection_reason } = req.body;
    const adminId = req.user.user_id;

    if (!Number.isInteger(hostId) || hostId <= 0) {
      return res.status(400).json({ message: "Invalid host id" });
    }

    if (!ALLOWED_STATUSES.includes(verification_status) || verification_status === "pending") {
      return res.status(400).json({
        message: "verification_status must be 'approved' or 'rejected'",
      });
    }

    if (verification_status === "rejected" && !String(rejection_reason || "").trim()) {
      return res.status(400).json({
        message: "rejection_reason is required when rejecting verification",
      });
    }

    const updateResult = await pool.query(
      `UPDATE host_verifications
       SET verification_status = $1,
           rejection_reason = $2,
           reviewed_by_admin_id = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE host_id = $4
       RETURNING *`,
      [
        verification_status,
        verification_status === "rejected" ? String(rejection_reason).trim() : null,
        adminId,
        hostId,
      ]
    );

    if (!updateResult.rows.length) {
      return res.status(404).json({ message: "Host verification submission not found" });
    }

    res.status(200).json({
      message: `Host verification ${verification_status} successfully`,
      verification: updateResult.rows[0],
    });
  } catch (err) {
    console.error("Error updating host verification status:", err);
    res.status(500).json({ message: "Server error updating host verification status" });
  }
};
