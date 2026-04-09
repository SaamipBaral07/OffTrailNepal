import pool from "../config/db.js";

const PAID_STATUSES = new Set(["success", "refund_requested", "refunded"]);
const DISALLOWED_BOOKING_STATUSES = new Set(["rejected", "expired"]);
const SUPPORTED_ROLES = new Set(["tourist", "guide"]);
const GUIDE_BOOKING_CHAT_WINDOW_DAYS = Math.max(
  0,
  Number.parseInt(process.env.GUIDE_BOOKING_CHAT_WINDOW_DAYS || "7", 10) || 7
);

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const parseDateOnly = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const asString = String(value || "").trim();
  if (!asString) return null;

  const dateOnly = asString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1], 10);
    const month = Number.parseInt(dateOnly[2], 10);
    const day = Number.parseInt(dateOnly[3], 10);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(asString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getChatAccessWindow = (endDateValue) => {
  const endDate = parseDateOnly(endDateValue);
  if (!endDate) {
    return {
      expiresAt: null,
      isClosed: false,
    };
  }

  const endOfServiceDayUtcMs = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
    23,
    59,
    59,
    999
  );

  const expiresAt = new Date(
    endOfServiceDayUtcMs + GUIDE_BOOKING_CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  return {
    expiresAt,
    isClosed: Date.now() > expiresAt.getTime(),
  };
};

export const getGuideBookingChatRoom = (bookingId) => `guide-booking-chat:${Number(bookingId)}`;

const mapMessageRow = (row, currentUserId) => ({
  message_id: row.message_id,
  booking_id: row.booking_id,
  guide_id: row.guide_id,
  tourist_id: row.tourist_id,
  sender_id: row.sender_id,
  sender_role: row.sender_role,
  sender_name: row.sender_name || (row.sender_role === "guide" ? "Guide" : "Tourist"),
  message_text: row.message_text,
  read_at: row.read_at,
  created_at: row.created_at,
  is_mine: Number(row.sender_id) === Number(currentUserId),
});

const mapThreadRow = (row) => {
  const chatWindow = getChatAccessWindow(row.end_date);

  return {
    booking_id: row.booking_id,
    booking_code: row.booking_code,
    service_title: row.service_title,
    trail_name: row.trail_name,
    start_date: row.start_date,
    end_date: row.end_date,
    booking_status: row.booking_status,
    payment_status: row.payment_status,
    guide_id: row.guide_id,
    guide_name: row.guide_name,
    tourist_id: row.tourist_id,
    tourist_name: row.tourist_name,
    last_message: row.last_message_id
      ? {
          message_id: row.last_message_id,
          sender_role: row.last_sender_role,
          message_text: row.last_message_text,
          created_at: row.last_message_created_at,
        }
      : null,
    unread_count: Number(row.unread_count || 0),
    can_chat: !chatWindow.isClosed,
    chat_window_closed: chatWindow.isClosed,
    chat_expires_at: chatWindow.expiresAt ? chatWindow.expiresAt.toISOString() : null,
    chat_window_days: GUIDE_BOOKING_CHAT_WINDOW_DAYS,
    chat_access_reason: chatWindow.isClosed
      ? `Chat window closed ${GUIDE_BOOKING_CHAT_WINDOW_DAYS} day(s) after trek completion`
      : null,
  };
};

export const assertGuideBookingChatAccess = async ({ bookingId, userId, userType, client: dbClient = pool }) => {
  const numericBookingId = Number.parseInt(bookingId, 10);
  const normalizedRole = normalizeRole(userType);

  if (!Number.isInteger(numericBookingId) || numericBookingId <= 0) {
    const error = new Error("Invalid booking id");
    error.statusCode = 400;
    throw error;
  }

  if (!SUPPORTED_ROLES.has(normalizedRole)) {
    const error = new Error("Only tourists and guides can access booking chat");
    error.statusCode = 403;
    throw error;
  }

  const result = await dbClient.query(
    `SELECT b.booking_id, b.booking_code, b.status AS booking_status,
            b.start_date, b.end_date,
            b.guide_id, b.tourist_id,
            gs.title AS service_title,
            trl.trail_name,
            g.full_name AS guide_name,
            t.full_name AS tourist_name,
            ps.payment_status
     FROM guide_package_bookings b
     JOIN guide_services gs ON gs.service_id = b.service_id
     JOIN trekking_trails trl ON trl.trail_id = b.trail_id
     JOIN guides g ON g.guide_id = b.guide_id
     JOIN tourists t ON t.tourist_id = b.tourist_id
     LEFT JOIN LATERAL (
       SELECT payment_status
       FROM guide_package_payment_sessions
       WHERE booking_id = b.booking_id
       ORDER BY created_at DESC
       LIMIT 1
     ) ps ON TRUE
     WHERE b.booking_id = $1
     LIMIT 1`,
    [numericBookingId]
  );

  if (!result.rows.length) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = result.rows[0];

  const isParticipant =
    (normalizedRole === "tourist" && Number(booking.tourist_id) === Number(userId)) ||
    (normalizedRole === "guide" && Number(booking.guide_id) === Number(userId));

  if (!isParticipant) {
    const error = new Error("You can chat only in your own booking conversations");
    error.statusCode = 403;
    throw error;
  }

  const paymentStatus = normalizeStatus(booking.payment_status);
  if (!PAID_STATUSES.has(paymentStatus)) {
    const error = new Error("Chat is available only for paid bookings");
    error.statusCode = 409;
    throw error;
  }

  const bookingStatus = normalizeStatus(booking.booking_status);
  if (DISALLOWED_BOOKING_STATUSES.has(bookingStatus)) {
    const error = new Error("Chat is unavailable for this booking status");
    error.statusCode = 409;
    throw error;
  }

  const chatWindow = getChatAccessWindow(booking.end_date);
  if (chatWindow.isClosed) {
    const error = new Error(`Chat window has closed ${GUIDE_BOOKING_CHAT_WINDOW_DAYS} day(s) after trek completion`);
    error.statusCode = 409;
    throw error;
  }

  return {
    booking_id: booking.booking_id,
    booking_code: booking.booking_code,
    booking_status: booking.booking_status,
    payment_status: booking.payment_status,
    start_date: booking.start_date,
    end_date: booking.end_date,
    service_title: booking.service_title,
    trail_name: booking.trail_name,
    guide_id: booking.guide_id,
    guide_name: booking.guide_name,
    tourist_id: booking.tourist_id,
    tourist_name: booking.tourist_name,
    can_chat: true,
    chat_window_closed: false,
    chat_expires_at: chatWindow.expiresAt ? chatWindow.expiresAt.toISOString() : null,
    chat_window_days: GUIDE_BOOKING_CHAT_WINDOW_DAYS,
  };
};

export const listMyGuideBookingChats = async ({ userId, userType }) => {
  const role = normalizeRole(userType);

  if (!SUPPORTED_ROLES.has(role)) {
    const error = new Error("Only tourists and guides can access booking chats");
    error.statusCode = 403;
    throw error;
  }

  const roleCondition = role === "guide" ? "b.guide_id = $1" : "b.tourist_id = $1";

  const result = await pool.query(
    `SELECT b.booking_id, b.booking_code, b.status AS booking_status,
            b.start_date, b.end_date,
            b.guide_id, b.tourist_id,
            gs.title AS service_title,
            trl.trail_name,
            g.full_name AS guide_name,
            t.full_name AS tourist_name,
            ps.payment_status,
            lm.message_id AS last_message_id,
            lm.message_text AS last_message_text,
            lm.sender_role AS last_sender_role,
            lm.created_at AS last_message_created_at,
            COALESCE(uc.unread_count, 0) AS unread_count
     FROM guide_package_bookings b
     JOIN guide_services gs ON gs.service_id = b.service_id
     JOIN trekking_trails trl ON trl.trail_id = b.trail_id
     JOIN guides g ON g.guide_id = b.guide_id
     JOIN tourists t ON t.tourist_id = b.tourist_id
     LEFT JOIN LATERAL (
       SELECT payment_status
       FROM guide_package_payment_sessions
       WHERE booking_id = b.booking_id
       ORDER BY created_at DESC
       LIMIT 1
     ) ps ON TRUE
     LEFT JOIN LATERAL (
       SELECT message_id, message_text, sender_role, created_at
       FROM guide_booking_chat_messages
       WHERE booking_id = b.booking_id
       ORDER BY created_at DESC
       LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM guide_booking_chat_messages m
       WHERE m.booking_id = b.booking_id
         AND m.sender_role <> $2
         AND m.read_at IS NULL
     ) uc ON TRUE
     WHERE ${roleCondition}
       AND COALESCE(ps.payment_status, '') IN ('success', 'refund_requested', 'refunded')
       AND b.status NOT IN ('rejected', 'expired')
     ORDER BY COALESCE(lm.created_at, b.created_at) DESC`,
    [userId, role]
  );

  return result.rows.map(mapThreadRow);
};

export const getGuideBookingChatMessages = async ({ bookingContext, currentUserId, limit = 200 }) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));

  const result = await pool.query(
    `SELECT m.message_id, m.booking_id, m.guide_id, m.tourist_id,
            m.sender_id, m.sender_role, m.message_text,
            m.read_at, m.created_at,
            CASE
              WHEN m.sender_role = 'guide' THEN g.full_name
              WHEN m.sender_role = 'tourist' THEN t.full_name
              ELSE NULL
            END AS sender_name
     FROM guide_booking_chat_messages m
     LEFT JOIN guides g ON g.guide_id = m.sender_id AND m.sender_role = 'guide'
     LEFT JOIN tourists t ON t.tourist_id = m.sender_id AND m.sender_role = 'tourist'
     WHERE m.booking_id = $1
       AND m.guide_id = $2
       AND m.tourist_id = $3
     ORDER BY m.created_at ASC
     LIMIT $4`,
    [bookingContext.booking_id, bookingContext.guide_id, bookingContext.tourist_id, safeLimit]
  );

  return result.rows.map((row) => mapMessageRow(row, currentUserId));
};

export const createGuideBookingChatMessage = async ({ bookingContext, senderId, senderRole, messageText, client: dbClient = pool }) => {
  const normalizedRole = normalizeRole(senderRole);
  const trimmedText = String(messageText || "").trim();

  if (!trimmedText) {
    const error = new Error("Message text is required");
    error.statusCode = 400;
    throw error;
  }

  if (trimmedText.length > 2000) {
    const error = new Error("Message text must be 2000 characters or less");
    error.statusCode = 400;
    throw error;
  }

  if (!SUPPORTED_ROLES.has(normalizedRole)) {
    const error = new Error("Invalid sender role");
    error.statusCode = 400;
    throw error;
  }

  const result = await dbClient.query(
    `INSERT INTO guide_booking_chat_messages
      (booking_id, guide_id, tourist_id, sender_id, sender_role, message_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING message_id, booking_id, guide_id, tourist_id,
               sender_id, sender_role, message_text, read_at, created_at`,
    [
      bookingContext.booking_id,
      bookingContext.guide_id,
      bookingContext.tourist_id,
      senderId,
      normalizedRole,
      trimmedText,
    ]
  );

  const row = result.rows[0];
  const senderName = normalizedRole === "guide" ? bookingContext.guide_name : bookingContext.tourist_name;
  return mapMessageRow({ ...row, sender_name: senderName }, senderId);
};

export const markGuideBookingChatRead = async ({ bookingContext, viewerRole, client: dbClient = pool }) => {
  const role = normalizeRole(viewerRole);
  if (!SUPPORTED_ROLES.has(role)) {
    const error = new Error("Invalid viewer role");
    error.statusCode = 400;
    throw error;
  }

  const result = await dbClient.query(
    `UPDATE guide_booking_chat_messages
     SET read_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE booking_id = $1
       AND guide_id = $2
       AND tourist_id = $3
       AND sender_role <> $4
       AND read_at IS NULL
     RETURNING message_id`,
    [bookingContext.booking_id, bookingContext.guide_id, bookingContext.tourist_id, role]
  );

  return {
    booking_id: bookingContext.booking_id,
    marked_count: result.rowCount,
    viewer_role: role,
    read_at: new Date().toISOString(),
  };
};
