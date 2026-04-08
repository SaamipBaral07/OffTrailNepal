import pool from "../config/db.js";

const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

export const getMyGuideVerificationStatus = async (req, res) => {
  try {
    const guideId = req.user.user_id;

    const result = await pool.query(
      `SELECT
         gv.id,
         gv.guide_id,
         gv.citizenship_doc_path,
         gv.guide_license_doc_path,
         gv.verification_status,
         gv.rejection_reason,
         gv.reviewed_by_admin_id,
         gv.reviewed_at,
         gv.created_at,
         gv.updated_at
       FROM guide_verifications gv
       WHERE gv.guide_id = $1`,
      [guideId]
    );

    res.status(200).json({
      verification: result.rows[0] || null,
    });
  } catch (err) {
    console.error("Error fetching guide verification status:", err);
    res.status(500).json({ message: "Server error fetching guide verification status" });
  }
};

export const submitGuideVerificationDocs = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    const files = req.files || {};
    const citizenshipFile = files.citizenship_image?.[0];
    const licenseFile = files.guide_license_image?.[0];

    const existingResult = await pool.query(
      `SELECT id, citizenship_doc_path, guide_license_doc_path
       FROM guide_verifications
       WHERE guide_id = $1`,
      [guideId]
    );

    const existing = existingResult.rows[0] || null;
    const citizenshipPath = citizenshipFile
      ? `/uploads/guide-verifications/${citizenshipFile.filename}`
      : existing?.citizenship_doc_path || null;
    const licensePath = licenseFile
      ? `/uploads/guide-verifications/${licenseFile.filename}`
      : existing?.guide_license_doc_path || null;

    if (!citizenshipPath || !licensePath) {
      return res.status(400).json({
        message: "Both citizenship_image and guide_license_image are required",
      });
    }

    const upsertResult = await pool.query(
      `INSERT INTO guide_verifications
         (guide_id, citizenship_doc_path, guide_license_doc_path, verification_status, rejection_reason, reviewed_by_admin_id, reviewed_at)
       VALUES ($1, $2, $3, 'pending', NULL, NULL, NULL)
       ON CONFLICT (guide_id)
       DO UPDATE SET
         citizenship_doc_path = EXCLUDED.citizenship_doc_path,
         guide_license_doc_path = EXCLUDED.guide_license_doc_path,
         verification_status = 'pending',
         rejection_reason = NULL,
         reviewed_by_admin_id = NULL,
         reviewed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [guideId, citizenshipPath, licensePath]
    );

    res.status(200).json({
      message: "Verification documents submitted. Waiting for admin approval.",
      verification: upsertResult.rows[0],
    });
  } catch (err) {
    console.error("Error submitting guide verification docs:", err);
    res.status(500).json({ message: "Server error submitting verification documents" });
  }
};

export const updateGuideVerificationStatus = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { verification_status, rejection_reason } = req.body;
    const adminId = req.user.user_id;

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
      `UPDATE guide_verifications
       SET verification_status = $1,
           rejection_reason = $2,
           reviewed_by_admin_id = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE guide_id = $4
       RETURNING *`,
      [
        verification_status,
        verification_status === "rejected" ? String(rejection_reason).trim() : null,
        adminId,
        guideId,
      ]
    );

    if (!updateResult.rows.length) {
      return res.status(404).json({ message: "Guide verification submission not found" });
    }

    res.status(200).json({
      message: `Guide verification ${verification_status} successfully`,
      verification: updateResult.rows[0],
    });
  } catch (err) {
    console.error("Error updating guide verification status:", err);
    res.status(500).json({ message: "Server error updating guide verification status" });
  }
};
