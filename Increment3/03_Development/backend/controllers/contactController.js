import pool from "../config/db.js";

const ALLOWED_CATEGORIES = new Set([
  "general",
  "booking",
  "host-support",
  "guide-support",
  "partnership",
]);

const ALLOWED_USER_TYPES = new Set(["tourist", "host", "guide", "admin"]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }
  return String(req.ip || "").trim() || null;
};

export const submitContactEnquiry = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const subject = String(req.body?.subject || "").trim();
    const category = String(req.body?.category || "general").trim().toLowerCase();
    const message = String(req.body?.message || "").trim();

    if (fullName.length < 2) {
      return res.status(400).json({ message: "Full name must be at least 2 characters" });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (subject.length < 4) {
      return res.status(400).json({ message: "Subject must be at least 4 characters" });
    }

    if (message.length < 15) {
      return res.status(400).json({ message: "Message must be at least 15 characters" });
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ message: "Invalid enquiry category" });
    }

    const rawUserId = Number(req.user?.user_id);
    const submitterUserId = Number.isInteger(rawUserId) && rawUserId > 0 ? rawUserId : null;
    const submitterUserType = ALLOWED_USER_TYPES.has(req.user?.user_type)
      ? req.user.user_type
      : null;

    const result = await pool.query(
      `INSERT INTO contact_enquiries
        (submitter_user_id, submitter_user_type, full_name, email, subject, category, message, source_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING enquiry_id, created_at`,
      [
        submitterUserId,
        submitterUserType,
        fullName,
        email,
        subject,
        category,
        message,
        getClientIp(req),
        String(req.headers["user-agent"] || "").trim() || null,
      ]
    );

    return res.status(201).json({
      message: "Your enquiry has been submitted successfully.",
      enquiry: result.rows[0],
    });
  } catch (err) {
    console.error("Error submitting contact enquiry:", err);
    return res.status(500).json({ message: "Server error while submitting enquiry" });
  }
};

export const getContactEnquiriesForAdmin = async (req, res) => {
  try {
    const requestedPage = Number.parseInt(String(req.query?.page || "1"), 10);
    const requestedLimit = Number.parseInt(String(req.query?.limit || "20"), 10);

    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;
    const offset = (page - 1) * limit;

    const [rowsResult, countResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT
           enquiry_id,
           submitter_user_id,
           submitter_user_type,
           full_name,
           email,
           subject,
           category,
           message,
           admin_reply_message,
           admin_reply_admin_id,
           admin_reply_at,
           admin_reply_read_at,
           source_ip,
           user_agent,
           created_at
         FROM contact_enquiries
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total_records FROM contact_enquiries`),
      pool.query(
        `SELECT
           COUNT(*)::int AS total_records,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
           COUNT(*) FILTER (WHERE category = 'booking')::int AS booking_related,
           COUNT(*) FILTER (WHERE admin_reply_message IS NOT NULL)::int AS replied_count,
           COUNT(*) FILTER (WHERE admin_reply_message IS NULL)::int AS pending_reply_count
         FROM contact_enquiries`
      ),
    ]);

    const totalRecords = countResult.rows[0]?.total_records || 0;
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return res.status(200).json({
      enquiries: rowsResult.rows,
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
      summary: summaryResult.rows[0] || {
        total_records: 0,
        last_24h: 0,
        booking_related: 0,
        replied_count: 0,
        pending_reply_count: 0,
      },
    });
  } catch (err) {
    console.error("Error fetching contact enquiries for admin:", err);
    return res.status(500).json({ message: "Server error while fetching enquiries" });
  }
};

export const replyToContactEnquiryAsAdmin = async (req, res) => {
  try {
    const enquiryId = Number.parseInt(String(req.params?.enquiryId || ""), 10);
    const replyMessage = String(req.body?.replyMessage || "").trim();
    const adminUserId = Number(req.user?.user_id);

    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({ message: "Invalid enquiry id" });
    }

    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return res.status(400).json({ message: "Invalid admin context" });
    }

    if (replyMessage.length < 8) {
      return res.status(400).json({ message: "Reply message must be at least 8 characters" });
    }

    const result = await pool.query(
      `UPDATE contact_enquiries
       SET
         admin_reply_message = $1,
         admin_reply_admin_id = $2,
         admin_reply_at = NOW(),
         admin_reply_read_at = NULL
       WHERE enquiry_id = $3
       RETURNING
         enquiry_id,
         submitter_user_id,
         submitter_user_type,
         full_name,
         email,
         subject,
         category,
         message,
         admin_reply_message,
         admin_reply_admin_id,
         admin_reply_at,
         admin_reply_read_at,
         created_at`,
      [replyMessage, adminUserId, enquiryId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Contact enquiry not found" });
    }

    return res.status(200).json({
      message: "Reply sent successfully.",
      enquiry: result.rows[0],
    });
  } catch (err) {
    console.error("Error replying to contact enquiry:", err);
    return res.status(500).json({ message: "Server error while replying to enquiry" });
  }
};

export const getMyContactEnquiryReplies = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const userType = String(req.user?.user_type || "").trim().toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0 || !ALLOWED_USER_TYPES.has(userType)) {
      return res.status(400).json({ message: "Invalid user context for enquiry replies" });
    }

    const requestedPage = Number.parseInt(String(req.query?.page || "1"), 10);
    const requestedLimit = Number.parseInt(String(req.query?.limit || "10"), 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 10;
    const offset = (page - 1) * limit;

    const [rowsResult, countResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT
           enquiry_id,
           subject,
           category,
           message,
           admin_reply_message,
           admin_reply_admin_id,
           admin_reply_at,
           admin_reply_read_at,
           created_at
         FROM contact_enquiries
         WHERE submitter_user_id = $1
           AND submitter_user_type = $2
           AND admin_reply_message IS NOT NULL
         ORDER BY COALESCE(admin_reply_at, created_at) DESC
         LIMIT $3 OFFSET $4`,
        [userId, userType, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_records
         FROM contact_enquiries
         WHERE submitter_user_id = $1
           AND submitter_user_type = $2
           AND admin_reply_message IS NOT NULL`,
        [userId, userType]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total_replies,
           COUNT(*) FILTER (WHERE admin_reply_read_at IS NULL)::int AS unread_replies
         FROM contact_enquiries
         WHERE submitter_user_id = $1
           AND submitter_user_type = $2
           AND admin_reply_message IS NOT NULL`,
        [userId, userType]
      ),
    ]);

    const totalRecords = Number(countResult.rows[0]?.total_records || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return res.status(200).json({
      replies: rowsResult.rows,
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
      summary: summaryResult.rows[0] || {
        total_replies: 0,
        unread_replies: 0,
      },
    });
  } catch (err) {
    console.error("Error fetching user contact enquiry replies:", err);
    return res.status(500).json({ message: "Server error while fetching replies" });
  }
};

export const markMyContactEnquiryRepliesAsRead = async (req, res) => {
  try {
    const userId = Number(req.user?.user_id);
    const userType = String(req.user?.user_type || "").trim().toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0 || !ALLOWED_USER_TYPES.has(userType)) {
      return res.status(400).json({ message: "Invalid user context for marking replies" });
    }

    const result = await pool.query(
      `WITH marked AS (
         UPDATE contact_enquiries
         SET admin_reply_read_at = NOW()
         WHERE submitter_user_id = $1
           AND submitter_user_type = $2
           AND admin_reply_message IS NOT NULL
           AND admin_reply_read_at IS NULL
         RETURNING enquiry_id
       )
       SELECT COUNT(*)::int AS marked_count FROM marked`,
      [userId, userType]
    );

    return res.status(200).json({
      message: "Replies marked as read.",
      marked_count: Number(result.rows[0]?.marked_count || 0),
    });
  } catch (err) {
    console.error("Error marking contact enquiry replies as read:", err);
    return res.status(500).json({ message: "Server error while marking replies as read" });
  }
};