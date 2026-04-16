import pool from "../config/db.js";
import crypto from "crypto";
import Stripe from "stripe";

const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
const ESEWA_PAYMENT_URL = process.env.ESEWA_PAYMENT_URL || "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_STATUS_CHECK_URL = process.env.ESEWA_STATUS_CHECK_URL || "https://rc-epay.esewa.com.np/api/epay/transaction/status/";
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";
const SERVER_PUBLIC_BASE_URL = process.env.SERVER_PUBLIC_BASE_URL || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const GUIDE_APPROVAL_WINDOW_HOURS = Number(process.env.GUIDE_APPROVAL_WINDOW_HOURS || 24);
const GUIDE_REFUND_FULL_HOURS = Number(process.env.GUIDE_REFUND_FULL_HOURS || 72);
const GUIDE_REFUND_PARTIAL_HOURS = Number(process.env.GUIDE_REFUND_PARTIAL_HOURS || 24);
const GUIDE_REFUND_PARTIAL_RATE = Number(process.env.GUIDE_REFUND_PARTIAL_RATE || 0.5);
const GUIDE_MIN_ADVANCE_DAYS = Math.max(
  1,
  Number.parseInt(process.env.GUIDE_MIN_ADVANCE_DAYS || "2", 10) || 2
);
const GUIDE_BOOKING_CHAT_WINDOW_DAYS = Math.max(
  0,
  Number.parseInt(process.env.GUIDE_BOOKING_CHAT_WINDOW_DAYS || "7", 10) || 7
);
const ACTIVE_GUIDE_BOOKING_STATUSES = ["pending", "confirmed"];
const CHAT_ELIGIBLE_PAYMENT_STATUSES = new Set(["success", "refund_requested", "refunded"]);
const CHAT_INELIGIBLE_BOOKING_STATUSES = new Set(["rejected", "expired"]);

const stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const normalizeGuideRefundStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "processed") return "refunded";
  return normalized;
};

const getGuideBookingChatExpiryDate = (endDateValue) => {
  const parsed = parseDateOnly(endDateValue, "end_date");
  if (parsed.error || !(parsed.value instanceof Date) || Number.isNaN(parsed.value.getTime())) {
    return null;
  }

  const endOfServiceDayUtcMs = Date.UTC(
    parsed.value.getUTCFullYear(),
    parsed.value.getUTCMonth(),
    parsed.value.getUTCDate(),
    23,
    59,
    59,
    999
  );

  const expiresAtMs = endOfServiceDayUtcMs + GUIDE_BOOKING_CHAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Date(expiresAtMs);
};

const resolveGuideBookingChatAccess = ({ bookingStatus, paymentStatus, endDate }) => {
  const normalizedBookingStatus = String(bookingStatus || "").trim().toLowerCase();
  const normalizedPaymentStatus = String(paymentStatus || "").trim().toLowerCase();

  if (!CHAT_ELIGIBLE_PAYMENT_STATUSES.has(normalizedPaymentStatus)) {
    return {
      canChat: false,
      chatExpiresAt: null,
      reason: "Chat is available only for paid bookings",
    };
  }

  if (CHAT_INELIGIBLE_BOOKING_STATUSES.has(normalizedBookingStatus)) {
    return {
      canChat: false,
      chatExpiresAt: null,
      reason: "Chat is unavailable for this booking status",
    };
  }

  const chatExpiresAt = getGuideBookingChatExpiryDate(endDate);
  if (!chatExpiresAt) {
    return {
      canChat: true,
      chatExpiresAt: null,
      reason: null,
    };
  }

  if (Date.now() > chatExpiresAt.getTime()) {
    return {
      canChat: false,
      chatExpiresAt,
      reason: `Chat window has closed ${GUIDE_BOOKING_CHAT_WINDOW_DAYS} day(s) after trek completion`,
    };
  }

  return {
    canChat: true,
    chatExpiresAt,
    reason: null,
  };
};

const logGuideTimelineEvent = async (
  client,
  { bookingId, actorRole, actorUserId = null, action, fromStatus = null, toStatus = null, note = null, metadata = null }
) => {
  await client.query(
    `INSERT INTO guide_booking_timeline
      (booking_id, actor_role, actor_user_id, action, from_status, to_status, note, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [bookingId, actorRole, actorUserId, action, fromStatus, toStatus, note, metadata ? JSON.stringify(metadata) : null]
  );
};

const createGuideRefundWithOptionalAutoProcess = async ({
  client,
  bookingId,
  sessionId,
  touristId,
  amount,
  provider,
  paymentReference,
  reason,
  policyRule,
  actorRole,
  actorUserId,
  note,
}) => {
  let refundStatus = "processing";
  let gatewayRefundReference = null;
  let gatewayResponse = null;
  const parsedActorUserId = Number.parseInt(actorUserId, 10);
  const reviewedByUserId = Number.isInteger(parsedActorUserId) ? parsedActorUserId : null;

  if (provider === "stripe" && stripeClient && String(paymentReference || "").startsWith("pi_")) {
    try {
      const stripeRefund = await stripeClient.refunds.create({ payment_intent: paymentReference });

      gatewayRefundReference = stripeRefund.id;
      gatewayResponse = {
        provider: "stripe",
        refund_id: stripeRefund.id,
        refund_status: stripeRefund.status,
        payment_intent: paymentReference,
        amount_minor: stripeRefund.amount,
        currency: stripeRefund.currency,
      };

      refundStatus = stripeRefund.status === "succeeded" ? "refunded" : "processing";
    } catch (err) {
      gatewayResponse = {
        provider: "stripe",
        auto_refund_error: err?.message || "auto_refund_failed",
      };
      refundStatus = "processing";
    }
  }

  await client.query(
    `INSERT INTO guide_booking_refunds
      (booking_id, session_id, tourist_id, requested_amount, approved_amount, currency,
       refund_reason, policy_rule, refund_status, provider, requested_at, reviewed_at, processed_at,
       reviewed_by_user_id, review_note, gateway_refund_reference, gateway_response, updated_at)
     VALUES
      ($1, $2, $3, $4, $4, 'NPR', $5, $6, $7::varchar, $8, CURRENT_TIMESTAMP,
       CASE WHEN $7::varchar IN ('refunded'::varchar, 'rejected'::varchar) THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $7::varchar = 'refunded'::varchar THEN CURRENT_TIMESTAMP ELSE NULL END,
      CASE WHEN $7::varchar IN ('refunded'::varchar, 'rejected'::varchar) THEN $9::integer ELSE NULL::integer END,
       CASE WHEN $7::varchar IN ('refunded'::varchar, 'rejected'::varchar) THEN $10 ELSE NULL END,
       $11, $12::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (booking_id)
     DO UPDATE SET session_id = EXCLUDED.session_id,
                   tourist_id = EXCLUDED.tourist_id,
                   requested_amount = EXCLUDED.requested_amount,
                   approved_amount = EXCLUDED.approved_amount,
                   refund_reason = EXCLUDED.refund_reason,
                   policy_rule = EXCLUDED.policy_rule,
                   refund_status = EXCLUDED.refund_status,
                   provider = EXCLUDED.provider,
                   requested_at = CURRENT_TIMESTAMP,
                   reviewed_at = EXCLUDED.reviewed_at,
                   processed_at = EXCLUDED.processed_at,
                   reviewed_by_user_id = EXCLUDED.reviewed_by_user_id,
                   review_note = EXCLUDED.review_note,
                   gateway_refund_reference = EXCLUDED.gateway_refund_reference,
                   gateway_response = EXCLUDED.gateway_response,
                   updated_at = CURRENT_TIMESTAMP`,
    [
      bookingId,
      sessionId || null,
      touristId,
      toMoney(amount),
      reason || null,
      policyRule,
      refundStatus,
      provider,
      reviewedByUserId,
      note || null,
      gatewayRefundReference,
      gatewayResponse ? JSON.stringify(gatewayResponse) : null,
    ]
  );

  await client.query(
    `UPDATE guide_package_payment_sessions
     SET payment_status = CASE WHEN $2 = 'refunded' THEN 'refunded' ELSE 'refund_requested' END,
         updated_at = CURRENT_TIMESTAMP
     WHERE booking_id = $1
       AND payment_status IN ('success', 'refund_requested', 'refunded')`,
    [bookingId, refundStatus]
  );

  await logGuideTimelineEvent(client, {
    bookingId,
    actorRole,
    actorUserId,
    action: "refund_status_updated",
    fromStatus: null,
    toStatus: refundStatus,
    note: reason || note || null,
    metadata: {
      policy_rule: policyRule,
      provider,
      gateway_refund_reference: gatewayRefundReference,
    },
  });

  return { refundStatus, gatewayRefundReference };
};

const processExpiredPendingGuideBookings = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dueResult = await client.query(
      `SELECT b.booking_id, b.status, b.tourist_id, b.total_price,
              ps.session_id, ps.payment_status, ps.payment_ref_id, ps.transaction_uuid,
              rf.refund_status
       FROM guide_package_bookings b
       LEFT JOIN LATERAL (
         SELECT session_id, payment_status, payment_ref_id, transaction_uuid
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_booking_refunds rf ON rf.booking_id = b.booking_id
       WHERE b.status = 'pending'
         AND b.approval_deadline_at <= CURRENT_TIMESTAMP
       FOR UPDATE OF b`
    );

    for (const booking of dueResult.rows) {
      await client.query(
        `UPDATE guide_package_bookings
         SET status = 'expired',
             decided_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1`,
        [booking.booking_id]
      );

      await logGuideTimelineEvent(client, {
        bookingId: booking.booking_id,
        actorRole: "system",
        action: "booking_expired",
        fromStatus: booking.status,
        toStatus: "expired",
        note: "Guide approval window expired.",
      });

      const paymentStatus = String(booking.payment_status || "").trim().toLowerCase();
      const refundStatus = normalizeGuideRefundStatus(booking.refund_status);
      const hasPaidSession = paymentStatus === "success" || paymentStatus === "refund_requested";

      if (!hasPaidSession || ["processing", "refunded"].includes(refundStatus)) {
        continue;
      }

      const provider =
        String(booking.transaction_uuid || "").toUpperCase().startsWith("GSPAY-") ? "stripe" : "esewa";

      await createGuideRefundWithOptionalAutoProcess({
        client,
        bookingId: booking.booking_id,
        sessionId: booking.session_id,
        touristId: booking.tourist_id,
        amount: booking.total_price,
        provider,
        paymentReference: booking.payment_ref_id,
        reason: "Booking expired due to guide non-approval.",
        policyRule: "guide_expired_unapproved",
        actorRole: "system",
        actorUserId: null,
        note: "Auto refund triggered after approval timeout",
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error processing expired guide bookings:", err);
  } finally {
    client.release();
  }
};

const toMoney = (value) => Number.parseFloat(Number(value).toFixed(2));

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldName} must be a positive integer`, value: null };
  }
  return { error: null, value: parsed };
};

const parseDateOnly = (value, fieldName) => {
  if (!value) return { error: `${fieldName} is required`, value: null };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { error: `${fieldName} is invalid`, value: null };
    }

    const isLocalMidnight =
      value.getHours() === 0 &&
      value.getMinutes() === 0 &&
      value.getSeconds() === 0 &&
      value.getMilliseconds() === 0;
    const isUtcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;

    const year = isLocalMidnight && !isUtcMidnight ? value.getFullYear() : value.getUTCFullYear();
    const month = isLocalMidnight && !isUtcMidnight ? value.getMonth() : value.getUTCMonth();
    const day = isLocalMidnight && !isUtcMidnight ? value.getDate() : value.getUTCDate();

    const normalized = new Date(Date.UTC(year, month, day));
    return { error: null, value: normalized };
  }

  const asString = String(value).trim();
  const ymdMatch = asString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!ymdMatch) {
    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) {
      return { error: `${fieldName} must be in YYYY-MM-DD format`, value: null };
    }

    parsed.setUTCHours(0, 0, 0, 0);
    return { error: null, value: parsed };
  }

  const year = Number.parseInt(ymdMatch[1], 10);
  const month = Number.parseInt(ymdMatch[2], 10);
  const day = Number.parseInt(ymdMatch[3], 10);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { error: `${fieldName} is invalid`, value: null };
  }

  return { error: null, value: parsed };
};

const evaluateGuideRefundPolicy = ({ startDate, paidAmount }) => {
  const amount = Number(paidAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: "invalid_amount",
      reason: "No eligible payment amount found for refund.",
      hoursUntilStartDate: null,
    };
  }

  const startParsed = parseDateOnly(startDate, "start_date");
  if (startParsed.error) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: "invalid_start_date",
      reason: "Booking start date is invalid for refund evaluation.",
      hoursUntilStartDate: null,
    };
  }

  const start = startParsed.value;
  const hoursUntilStartDate = Math.floor((start.getTime() - Date.now()) / (1000 * 60 * 60));

  if (!Number.isFinite(hoursUntilStartDate)) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: "invalid_start_date",
      reason: "Booking start date is invalid for refund evaluation.",
      hoursUntilStartDate: null,
    };
  }

  if (hoursUntilStartDate < 0) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: "service_started",
      reason: "Refund is not available on or after the trek start date.",
      hoursUntilStartDate,
    };
  }

  if (hoursUntilStartDate < GUIDE_REFUND_PARTIAL_HOURS) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: `not_eligible_under_${GUIDE_REFUND_PARTIAL_HOURS}h`,
      reason: `Refund is not available within ${GUIDE_REFUND_PARTIAL_HOURS} hours of trek start date.`,
      hoursUntilStartDate,
    };
  }

  const partialRate = Math.max(0, Math.min(1, GUIDE_REFUND_PARTIAL_RATE));
  const isFull = hoursUntilStartDate >= GUIDE_REFUND_FULL_HOURS;
  const refundRate = isFull ? 1 : partialRate;
  const refundAmount = toMoney(amount * refundRate);

  if (refundAmount <= 0) {
    return {
      eligible: false,
      refundAmount: 0,
      refundRate: 0,
      ruleCode: "zero_refund",
      reason: "Calculated refund amount is zero.",
      hoursUntilStartDate,
    };
  }

  return {
    eligible: true,
    refundAmount,
    refundRate,
    ruleCode: isFull
      ? `full_${GUIDE_REFUND_FULL_HOURS}h`
      : `partial_${GUIDE_REFUND_PARTIAL_HOURS}h`,
    reason: isFull
      ? `Eligible for full refund (${GUIDE_REFUND_FULL_HOURS}+ hours before trek start date).`
      : `Eligible for partial refund (${Math.round(refundRate * 100)}%) between ${GUIDE_REFUND_PARTIAL_HOURS} and ${GUIDE_REFUND_FULL_HOURS} hours before trek start date.`,
    hoursUntilStartDate,
  };
};

const buildGuideRefundExceptionResponse = (err, action = "request") => {
  const dbCode = String(err?.code || "").trim();

  if (["42703", "42P01"].includes(dbCode)) {
    return {
      status: 500,
      code: "GUIDE_REFUND_SCHEMA_ERROR",
      message:
        "Guide refund service is temporarily unavailable due to a server configuration issue. Please contact support.",
    };
  }

  if (dbCode === "23503") {
    return {
      status: 409,
      code: "GUIDE_REFUND_DATA_INTEGRITY_ERROR",
      message:
        "Guide refund could not be completed because related booking or payment data is missing. Please contact support.",
    };
  }

  if (["40001", "40P01"].includes(dbCode)) {
    return {
      status: 409,
      code: "GUIDE_REFUND_CONFLICT_RETRY",
      message: "Another refund operation is in progress for this guide booking. Please retry.",
    };
  }

  return {
    status: 500,
    code: action === "review" ? "GUIDE_REFUND_REVIEW_FAILED" : "GUIDE_REFUND_REQUEST_FAILED",
    message:
      action === "review"
        ? "Server error reviewing guide refund"
        : "Server error requesting guide booking refund",
  };
};

const toDateOnly = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayUtcDateOnly = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

const getEarliestGuideStartDate = () => {
  const earliest = getTodayUtcDateOnly();
  earliest.setUTCDate(earliest.getUTCDate() + GUIDE_MIN_ADVANCE_DAYS);
  return earliest;
};

const getLeadTimeValidationMessage = () => {
  const earliest = getEarliestGuideStartDate();
  return `Guide bookings must be made at least ${GUIDE_MIN_ADVANCE_DAYS} day(s) in advance. Earliest start_date is ${toDateOnly(earliest)}.`;
};

const findGuideDateConflict = async ({ client, guideId, startDate, endDate }) => {
  const startDateKey = toDateOnly(startDate);
  const endDateKey = toDateOnly(endDate);

  const overlapResult = await client.query(
    `SELECT b.booking_id,
            to_char(b.start_date::date, 'YYYY-MM-DD') AS booked_start_date,
            to_char(b.end_date::date, 'YYYY-MM-DD') AS booked_end_date
     FROM guide_package_bookings b
     WHERE b.guide_id = $1
       AND b.status = ANY($2::text[])
       AND daterange(b.start_date::date, b.end_date::date, '[]')
           && daterange($3::date, $4::date, '[]')
     ORDER BY b.created_at ASC
     LIMIT 1`,
    [guideId, ACTIVE_GUIDE_BOOKING_STATUSES, startDateKey, endDateKey]
  );

  if (overlapResult.rows.length > 0) {
    const overlap = overlapResult.rows[0];
    return {
      code: "GUIDE_DATE_OVERLAP",
      message: `Guide is already booked for ${overlap.booked_start_date} to ${overlap.booked_end_date}. Please choose another date range.`,
    };
  }

  const unavailableResult = await client.query(
    `SELECT to_char(ga.available_date::date, 'YYYY-MM-DD') AS unavailable_date
     FROM guide_availability ga
     WHERE ga.guide_id = $1
       AND ga.is_available = false
       AND ga.available_date BETWEEN $2::date AND $3::date
     ORDER BY ga.available_date ASC
     LIMIT 1`,
    [guideId, startDateKey, endDateKey]
  );

  if (unavailableResult.rows.length > 0) {
    const unavailable = unavailableResult.rows[0];
    return {
      code: "GUIDE_DATE_UNAVAILABLE",
      message: `Guide marked ${unavailable.unavailable_date} as unavailable. Please choose another date range.`,
    };
  }

  return null;
};

const createEsewaSignature = ({ totalAmount, transactionUuid, productCode }) => {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac("sha256", ESEWA_SECRET_KEY).update(message).digest("base64");
};

const decodeEsewaDataParam = (encodedData) => {
  if (!encodedData || typeof encodedData !== "string") return null;
  try {
    const normalized = encodedData.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getServerBaseUrl = (req) => {
  if (SERVER_PUBLIC_BASE_URL) return SERVER_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
};

const getCallbackField = (req, fieldName) => {
  const queryVal = req.query?.[fieldName];
  if (queryVal !== undefined && queryVal !== null && String(queryVal).trim() !== "") {
    return String(queryVal).trim();
  }

  const bodyVal = req.body?.[fieldName];
  if (bodyVal !== undefined && bodyVal !== null && String(bodyVal).trim() !== "") {
    return String(bodyVal).trim();
  }

  return "";
};

const getGuidePaymentFailureRedirectUrl = ({ serviceId, sessionToken, reason }) => {
  const params = new URLSearchParams();
  params.set("payment", "failed");
  params.set("booking_type", "guide_package");
  if (sessionToken) params.set("session_token", sessionToken);
  if (serviceId) params.set("service_id", String(serviceId));
  if (reason) params.set("reason", reason);

  return `${CLIENT_BASE_URL}/payment/failed?${params.toString()}`;
};

const getGuidePaymentSuccessRedirectUrl = ({ serviceId, sessionToken }) => {
  const params = new URLSearchParams();
  params.set("payment", "success");
  params.set("booking_type", "guide_package");
  if (sessionToken) params.set("session_token", sessionToken);
  if (serviceId) params.set("service_id", String(serviceId));

  return `${CLIENT_BASE_URL}/payment/success?${params.toString()}`;
};

const getGuideSessionByTokenOrTransaction = async ({ sessionToken, transactionUuid }) => {
  if (sessionToken) {
    const byToken = await pool.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_token = $1`,
      [sessionToken]
    );
    if (byToken.rows.length) return byToken.rows[0];
  }

  if (transactionUuid) {
    const byTransaction = await pool.query(
      `SELECT * FROM guide_package_payment_sessions WHERE transaction_uuid = $1`,
      [transactionUuid]
    );
    if (byTransaction.rows.length) return byTransaction.rows[0];
  }

  return null;
};

const isEsewaSuccessStatus = (statusValue) => {
  const status = String(statusValue || "").trim().toUpperCase();
  return ["COMPLETE", "COMPLETED", "SUCCESS", "PAID"].includes(status);
};

const parseEsewaStatusPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload.status ||
    payload.transaction_status ||
    payload.transactionStatus ||
    payload.transaction_details?.status ||
    payload.data?.status ||
    null
  );
};

const validateGuidePackageDraft = async ({
  client,
  serviceId,
  startDate,
  endDate,
  participantsCount,
}) => {
  const result = await client.query(
    `SELECT gs.service_id, gs.guide_id, gs.trail_id, gs.title, gs.price_per_day, gs.max_group_size, gs.min_booking_days,
            g.full_name AS guide_name
     FROM guide_services gs
     JOIN guides g ON gs.guide_id = g.guide_id
     JOIN guide_trails gt ON gt.guide_id = gs.guide_id AND gt.trail_id = gs.trail_id
     JOIN guide_verifications gv ON gv.guide_id = gs.guide_id
     WHERE gs.service_id = $1
       AND gs.is_active = true
       AND gs.approval_status = 'approved'
       AND gt.is_active = true
       AND gv.verification_status = 'approved'`,
    [serviceId]
  );

  if (!result.rows.length) {
    return { error: "Guide package is not available", status: 404 };
  }

  const service = result.rows[0];

  if (participantsCount > Number(service.max_group_size || 1)) {
    return {
      error: `Selected package supports up to ${service.max_group_size} participants`,
      status: 400,
    };
  }

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return { error: "end_date must be after start_date", status: 400 };
  }

  const minBookingDays = Math.max(1, Number.parseInt(service.min_booking_days, 10) || 1);
  if (totalDays < minBookingDays) {
    return {
      error: `This package requires a minimum booking of ${minBookingDays} day(s). Please choose a longer date range.`,
      status: 400,
      code: "GUIDE_MIN_PACKAGE_DAYS_NOT_MET",
    };
  }

  const earliestGuideStartDate = getEarliestGuideStartDate();
  if (startDate < earliestGuideStartDate) {
    return {
      error: getLeadTimeValidationMessage(),
      status: 400,
      code: "GUIDE_MIN_ADVANCE_NOT_MET",
    };
  }

  const dateConflict = await findGuideDateConflict({
    client,
    guideId: service.guide_id,
    startDate,
    endDate,
  });

  if (dateConflict) {
    return {
      error: dateConflict.message,
      status: 409,
      code: dateConflict.code,
    };
  }

  const normalizedParticipantsCount = Math.max(1, Number.parseInt(participantsCount, 10) || 1);
  const ratePerParticipantPerDay = toMoney(Number(service.price_per_day));
  const amount = toMoney(ratePerParticipantPerDay * totalDays * normalizedParticipantsCount);

  return {
    error: null,
    status: 200,
    service,
    totalDays,
    participantsCount: normalizedParticipantsCount,
    ratePerParticipantPerDay,
    amount,
  };
};

const generateGuideBookingCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `OTG-${stamp}-${rand}`;
};

const createGuideBookingFromPaymentSession = async ({ client, session, touristId }) => {
  const startDateParsed = parseDateOnly(session.start_date, "start_date");
  const endDateParsed = parseDateOnly(session.end_date, "end_date");

  if (startDateParsed.error || endDateParsed.error) {
    return { error: "Invalid booking dates in payment session", status: 400 };
  }

  const guideLockResult = await client.query(
    `SELECT guide_id FROM guides WHERE guide_id = $1 FOR UPDATE`,
    [session.guide_id]
  );

  if (!guideLockResult.rows.length) {
    return { error: "Guide is not available for booking", status: 404 };
  }

  const draft = await validateGuidePackageDraft({
    client,
    serviceId: session.service_id,
    startDate: startDateParsed.value,
    endDate: endDateParsed.value,
    participantsCount: Number(session.participants_count),
  });

  if (draft.error) {
    return { error: draft.error, status: draft.status };
  }

  const expectedAmount = toMoney(session.amount);
  if (toMoney(draft.amount) !== expectedAmount) {
    return {
      error: "Guide package price changed before payment verification. Please initiate payment again.",
      status: 409,
    };
  }

  const bookingResult = await client.query(
    `INSERT INTO guide_package_bookings
      (booking_code, service_id, guide_id, tourist_id, trail_id, start_date, end_date,
       participants_count, contact_phone, special_requests, status, total_price, approval_deadline_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, CURRENT_TIMESTAMP + ($12 || ' hours')::interval)
     RETURNING *`,
    [
      generateGuideBookingCode(),
      session.service_id,
      session.guide_id,
      touristId,
      session.trail_id,
      toDateOnly(startDateParsed.value),
      toDateOnly(endDateParsed.value),
      session.participants_count,
      session.contact_phone || null,
      session.special_requests || null,
      expectedAmount,
      GUIDE_APPROVAL_WINDOW_HOURS,
    ]
  );

  await logGuideTimelineEvent(client, {
    bookingId: bookingResult.rows[0].booking_id,
    actorRole: "system",
    action: "booking_created_paid_pending_approval",
    fromStatus: null,
    toStatus: "pending",
    note: `Awaiting guide approval within ${GUIDE_APPROVAL_WINDOW_HOURS} hours`,
    metadata: {
      tourist_id: touristId,
      service_id: session.service_id,
    },
  });

  return {
    error: null,
    status: 201,
    booking: {
      ...bookingResult.rows[0],
      guide_name: draft.service.guide_name,
      service_title: draft.service.title,
      total_days: draft.totalDays,
    },
  };
};

export const initiateGuideEsewaPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const {
      service_id,
      start_date,
      end_date,
      participants_count,
      contact_phone,
      special_requests,
    } = req.body;

    const serviceId = Number.parseInt(service_id, 10);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({ message: "Invalid service id" });
    }

    const startParsed = parseDateOnly(start_date, "start_date");
    const endParsed = parseDateOnly(end_date, "end_date");
    const participantsParsed = parsePositiveInt(participants_count, "participants_count");
    const firstError = startParsed.error || endParsed.error || participantsParsed.error;

    if (firstError) {
      return res.status(400).json({ message: firstError });
    }

    if (endParsed.value <= startParsed.value) {
      return res.status(400).json({ message: "end_date must be after start_date" });
    }

    const draft = await validateGuidePackageDraft({
      client,
      serviceId,
      startDate: startParsed.value,
      endDate: endParsed.value,
      participantsCount: participantsParsed.value,
    });

    if (draft.error) {
      return res.status(draft.status).json({ message: draft.error });
    }

    const sessionToken = crypto.randomBytes(24).toString("hex");
    const transactionUuid = `GEPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const amount = toMoney(draft.amount);
    const taxAmount = 0;
    const serviceCharge = 0;
    const totalAmount = toMoney(amount + taxAmount + serviceCharge);

    const totalAmountStr = totalAmount.toFixed(2);
    const signature = createEsewaSignature({
      totalAmount: totalAmountStr,
      transactionUuid,
      productCode: ESEWA_PRODUCT_CODE,
    });

    const serverBaseUrl = getServerBaseUrl(req);
    const successUrl =
      `${serverBaseUrl}/api/guide-bookings/payment/esewa/success` +
      `?session_token=${encodeURIComponent(sessionToken)}` +
      `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;
    const failureUrl =
      `${serverBaseUrl}/api/guide-bookings/payment/esewa/failure` +
      `?session_token=${encodeURIComponent(sessionToken)}` +
      `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;

    await client.query(
      `INSERT INTO guide_package_payment_sessions
        (session_token, tourist_id, service_id, guide_id, trail_id, start_date, end_date,
         participants_count, contact_phone, special_requests, total_days, rate_per_day,
         amount, tax_amount, service_charge, total_amount, transaction_uuid, payment_status, payment_response)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, 'initiated', $18::jsonb)`,
      [
        sessionToken,
        touristId,
        serviceId,
        draft.service.guide_id,
        draft.service.trail_id,
        toDateOnly(startParsed.value),
        toDateOnly(endParsed.value),
        participantsParsed.value,
        (contact_phone || "").trim() || null,
        (special_requests || "").trim() || null,
        draft.totalDays,
        toMoney(draft.service.price_per_day),
        amount,
        taxAmount,
        serviceCharge,
        totalAmount,
        transactionUuid,
        JSON.stringify({ provider: "esewa" }),
      ]
    );

    return res.status(200).json({
      message: "Guide package payment initiated.",
      session_token: sessionToken,
      booking_type: "guide_package",
      payment_form: {
        action: ESEWA_PAYMENT_URL,
        method: "POST",
        fields: {
          amount: amount.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          total_amount: totalAmountStr,
          transaction_uuid: transactionUuid,
          product_code: ESEWA_PRODUCT_CODE,
          product_service_charge: serviceCharge.toFixed(2),
          product_delivery_charge: "0.00",
          success_url: successUrl,
          failure_url: failureUrl,
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature,
        },
      },
      booking_preview: {
        service_id: draft.service.service_id,
        service_title: draft.service.title,
        guide_id: draft.service.guide_id,
        guide_name: draft.service.guide_name,
        participants_count: participantsParsed.value,
        total_days: draft.totalDays,
        rate_per_participant_per_day: draft.ratePerParticipantPerDay,
        amount,
        total_amount: totalAmount,
      },
    });
  } catch (err) {
    console.error("Error initiating guide eSewa payment:", err);
    return res.status(500).json({ message: "Server error initiating guide package payment" });
  } finally {
    client.release();
  }
};

export const initiateGuideStripePayment = async (req, res) => {
  if (!stripeClient) {
    return res.status(500).json({ message: "Stripe is not configured on server" });
  }

  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const {
      service_id,
      start_date,
      end_date,
      participants_count,
      contact_phone,
      special_requests,
    } = req.body;

    const serviceId = Number.parseInt(service_id, 10);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({ message: "Invalid service id" });
    }

    const startParsed = parseDateOnly(start_date, "start_date");
    const endParsed = parseDateOnly(end_date, "end_date");
    const participantsParsed = parsePositiveInt(participants_count, "participants_count");
    const firstError = startParsed.error || endParsed.error || participantsParsed.error;

    if (firstError) {
      return res.status(400).json({ message: firstError });
    }

    if (endParsed.value <= startParsed.value) {
      return res.status(400).json({ message: "end_date must be after start_date" });
    }

    const draft = await validateGuidePackageDraft({
      client,
      serviceId,
      startDate: startParsed.value,
      endDate: endParsed.value,
      participantsCount: participantsParsed.value,
    });

    if (draft.error) {
      return res.status(draft.status).json({ message: draft.error });
    }

    const sessionToken = crypto.randomBytes(24).toString("hex");
    const transactionUuid = `GSPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const amountNpr = toMoney(draft.amount);
    const taxAmount = 0;
    const serviceCharge = 0;
    const totalAmountNpr = toMoney(amountNpr + taxAmount + serviceCharge);
    const stripeAmountMinor = Math.max(1, Math.round(totalAmountNpr * 100));

    await client.query(
      `INSERT INTO guide_package_payment_sessions
        (session_token, tourist_id, service_id, guide_id, trail_id, start_date, end_date,
         participants_count, contact_phone, special_requests, total_days, rate_per_day,
         amount, tax_amount, service_charge, total_amount, transaction_uuid, payment_status, payment_response)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, 'initiated', $18::jsonb)`,
      [
        sessionToken,
        touristId,
        serviceId,
        draft.service.guide_id,
        draft.service.trail_id,
        toDateOnly(startParsed.value),
        toDateOnly(endParsed.value),
        participantsParsed.value,
        (contact_phone || "").trim() || null,
        (special_requests || "").trim() || null,
        draft.totalDays,
        toMoney(draft.service.price_per_day),
        amountNpr,
        taxAmount,
        serviceCharge,
        totalAmountNpr,
        transactionUuid,
        JSON.stringify({
          provider: "stripe",
          stripe_currency: "npr",
          stripe_amount_minor: stripeAmountMinor,
        }),
      ]
    );

    const serverBaseUrl = getServerBaseUrl(req);
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "npr",
            unit_amount: stripeAmountMinor,
            product_data: {
              name: `Guide Package - ${draft.service.title}`,
              description: `${draft.totalDays} day(s), ${participantsParsed.value} participant(s)`,
            },
          },
        },
      ],
      success_url:
        `${serverBaseUrl}/api/guide-bookings/payment/stripe/success` +
        `?session_token=${encodeURIComponent(sessionToken)}` +
        `&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${serverBaseUrl}/api/guide-bookings/payment/stripe/cancel` +
        `?session_token=${encodeURIComponent(sessionToken)}`,
      metadata: {
        session_token: sessionToken,
        transaction_uuid: transactionUuid,
        service_id: String(serviceId),
        guide_id: String(draft.service.guide_id),
        tourist_id: String(touristId),
      },
    });

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_ref_id = $1,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_token = $3`,
      [
        checkoutSession.id,
        JSON.stringify({
          stripe_checkout_session_id: checkoutSession.id,
          stripe_checkout_status: checkoutSession.status,
        }),
        sessionToken,
      ]
    );

    return res.status(200).json({
      message: "Stripe checkout initialized for guide package.",
      session_token: sessionToken,
      booking_type: "guide_package",
      provider: "stripe",
      checkout_url: checkoutSession.url,
      booking_preview: {
        service_id: draft.service.service_id,
        service_title: draft.service.title,
        guide_id: draft.service.guide_id,
        guide_name: draft.service.guide_name,
        participants_count: participantsParsed.value,
        total_days: draft.totalDays,
        rate_per_participant_per_day: draft.ratePerParticipantPerDay,
        amount_npr: totalAmountNpr,
      },
    });
  } catch (err) {
    console.error("Error initiating guide Stripe payment:", err);
    return res.status(500).json({ message: "Server error initiating guide package Stripe payment" });
  } finally {
    client.release();
  }
};

export const handleGuideEsewaSuccessCallback = async (req, res) => {
  const client = await pool.connect();

  try {
    const sessionToken = getCallbackField(req, "session_token");
    const callbackData = decodeEsewaDataParam(getCallbackField(req, "data"));
    const transactionUuid =
      String(
        getCallbackField(req, "transaction_uuid") ||
          callbackData?.transaction_uuid ||
          callbackData?.transaction_uuid2 ||
          ""
      ).trim() || null;

    const session = await getGuideSessionByTokenOrTransaction({ sessionToken, transactionUuid });
    if (!session) {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken, reason: "session_not_found" }));
    }

    if (session.payment_status === "success" && session.booking_id) {
      return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: session.service_id, sessionToken: session.session_token }));
    }

    const checkUrl =
      `${ESEWA_STATUS_CHECK_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}` +
      `&total_amount=${encodeURIComponent(Number(session.total_amount).toFixed(2))}` +
      `&transaction_uuid=${encodeURIComponent(session.transaction_uuid)}`;

    let statusPayload = null;
    try {
      const response = await fetch(checkUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        statusPayload = await response.json();
      }
    } catch (fetchErr) {
      console.error("Error checking eSewa guide payment status:", fetchErr);
    }

    const paymentStatus = parseEsewaStatusPayload(statusPayload);
    if (!isEsewaSuccessStatus(paymentStatus)) {
      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "esewa", verify_payload: statusPayload || null }), session.session_id]
      );

      return res.redirect(
        getGuidePaymentFailureRedirectUrl({
          serviceId: session.service_id,
          sessionToken: session.session_token,
          reason: "verification_failed",
        })
      );
    }

    await client.query("BEGIN");

    const lockResult = await client.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_id = $1 FOR UPDATE`,
      [session.session_id]
    );

    if (!lockResult.rows.length) {
      await client.query("ROLLBACK");
      return res.redirect(
        getGuidePaymentFailureRedirectUrl({
          serviceId: session.service_id,
          sessionToken: session.session_token,
          reason: "session_missing",
        })
      );
    }

    const lockedSession = lockResult.rows[0];

    if (lockedSession.payment_status === "success" && lockedSession.booking_id) {
      await client.query("COMMIT");
      return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: lockedSession.service_id, sessionToken: lockedSession.session_token }));
    }

    const bookingCreation = await createGuideBookingFromPaymentSession({
      client,
      session: lockedSession,
      touristId: lockedSession.tourist_id,
    });

    if (bookingCreation.error) {
      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "esewa", booking_error: bookingCreation.error }), lockedSession.session_id]
      );
      await client.query("COMMIT");

      return res.redirect(
        getGuidePaymentFailureRedirectUrl({
          serviceId: lockedSession.service_id,
          sessionToken: lockedSession.session_token,
          reason: "booking_creation_failed",
        })
      );
    }

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           payment_ref_id = COALESCE($2, payment_ref_id),
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $3::jsonb,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $4`,
      [
        bookingCreation.booking.booking_id,
        callbackData?.ref_id || callbackData?.transaction_code || null,
        JSON.stringify({ provider: "esewa", verify_payload: statusPayload || null }),
        lockedSession.session_id,
      ]
    );

    await client.query("COMMIT");

    return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: lockedSession.service_id, sessionToken: lockedSession.session_token }));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error handling guide eSewa success callback:", err);
    const fallbackSessionToken = getCallbackField(req, "session_token");
    return res.redirect(
      getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken: fallbackSessionToken, reason: "server_error" })
    );
  } finally {
    client.release();
  }
};

export const handleGuideEsewaFailureCallback = async (req, res) => {
  try {
    const sessionToken = getCallbackField(req, "session_token");
    const transactionUuid = getCallbackField(req, "transaction_uuid");
    const reason = getCallbackField(req, "reason") || "gateway_cancelled";

    const session = await getGuideSessionByTokenOrTransaction({ sessionToken, transactionUuid });
    if (!session) {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken, reason: "session_not_found" }));
    }

    await pool.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = CASE WHEN payment_status = 'success' THEN payment_status ELSE 'failed' END,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $2`,
      [JSON.stringify({ provider: "esewa", failure_reason: reason }), session.session_id]
    );

    return res.redirect(
      getGuidePaymentFailureRedirectUrl({
        serviceId: session.service_id,
        sessionToken: session.session_token,
        reason,
      })
    );
  } catch (err) {
    console.error("Error handling guide eSewa failure callback:", err);
    return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken: "", reason: "server_error" }));
  }
};

export const handleGuideStripeSuccessCallback = async (req, res) => {
  if (!stripeClient) {
    return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken: "", reason: "stripe_not_configured" }));
  }

  const client = await pool.connect();

  try {
    const sessionToken = getCallbackField(req, "session_token");
    const checkoutSessionId = getCallbackField(req, "checkout_session_id");

    const sessionRow = await pool.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (!sessionRow.rows.length) {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken, reason: "session_not_found" }));
    }

    const session = sessionRow.rows[0];

    if (session.payment_status === "success" && session.booking_id) {
      return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: session.service_id, sessionToken: session.session_token }));
    }

    const stripeSessionId = checkoutSessionId || session.payment_ref_id;
    if (!stripeSessionId) {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: session.service_id, sessionToken: session.session_token, reason: "missing_checkout_session" }));
    }

    const stripeCheckout = await stripeClient.checkout.sessions.retrieve(stripeSessionId, {
      expand: ["payment_intent"],
    });
    if (stripeCheckout.payment_status !== "paid") {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: session.service_id, sessionToken: session.session_token, reason: "stripe_not_paid" }));
    }

    await client.query("BEGIN");

    const lockResult = await client.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_id = $1 FOR UPDATE`,
      [session.session_id]
    );

    const lockedSession = lockResult.rows[0];

    if (lockedSession.payment_status === "success" && lockedSession.booking_id) {
      await client.query("COMMIT");
      return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: lockedSession.service_id, sessionToken: lockedSession.session_token }));
    }

    const bookingCreation = await createGuideBookingFromPaymentSession({
      client,
      session: lockedSession,
      touristId: lockedSession.tourist_id,
    });

    if (bookingCreation.error) {
      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "stripe", booking_error: bookingCreation.error }), lockedSession.session_id]
      );

      await client.query("COMMIT");

      return res.redirect(
        getGuidePaymentFailureRedirectUrl({
          serviceId: lockedSession.service_id,
          sessionToken: lockedSession.session_token,
          reason: "booking_creation_failed",
        })
      );
    }

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           payment_ref_id = $2,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $3::jsonb,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $4`,
      [
        bookingCreation.booking.booking_id,
        stripeCheckout.payment_intent?.id || stripeCheckout.id,
        JSON.stringify({ provider: "stripe", stripe_checkout_status: stripeCheckout.payment_status }),
        lockedSession.session_id,
      ]
    );

    await client.query("COMMIT");

    return res.redirect(getGuidePaymentSuccessRedirectUrl({ serviceId: lockedSession.service_id, sessionToken: lockedSession.session_token }));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error handling guide Stripe success callback:", err);
    const sessionToken = getCallbackField(req, "session_token");
    return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken, reason: "server_error" }));
  } finally {
    client.release();
  }
};

export const handleGuideStripeCancelCallback = async (req, res) => {
  try {
    const sessionToken = getCallbackField(req, "session_token");
    const sessionResult = await pool.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken, reason: "session_not_found" }));
    }

    const session = sessionResult.rows[0];

    await pool.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = CASE WHEN payment_status = 'success' THEN payment_status ELSE 'failed' END,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $2`,
      [JSON.stringify({ provider: "stripe", cancel_reason: "user_cancelled" }), session.session_id]
    );

    return res.redirect(
      getGuidePaymentFailureRedirectUrl({
        serviceId: session.service_id,
        sessionToken: session.session_token,
        reason: "user_cancelled",
      })
    );
  } catch (err) {
    console.error("Error handling guide Stripe cancel callback:", err);
    return res.redirect(getGuidePaymentFailureRedirectUrl({ serviceId: "", sessionToken: "", reason: "server_error" }));
  }
};

export const verifyGuideEsewaPaymentAndCreateBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const sessionToken = String(req.body?.session_token || "").trim();
    if (!sessionToken) {
      return res.status(400).json({ message: "session_token is required" });
    }

    await client.query("BEGIN");

    const sessionResult = await client.query(
      `SELECT * FROM guide_package_payment_sessions WHERE session_token = $1 FOR UPDATE`,
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Payment session not found" });
    }

    const session = sessionResult.rows[0];

    if (Number(session.tourist_id) !== Number(touristId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can verify only your own guide payment session" });
    }

    if (session.payment_status === "success" && session.booking_id) {
      const existingBooking = await client.query(
        `SELECT booking_id, booking_code, status FROM guide_package_bookings WHERE booking_id = $1`,
        [session.booking_id]
      );
      await client.query("COMMIT");

      return res.status(200).json({
        message: "Guide package payment already verified",
        booking: existingBooking.rows[0] || null,
        payment_status: session.payment_status,
      });
    }

    const checkUrl =
      `${ESEWA_STATUS_CHECK_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}` +
      `&total_amount=${encodeURIComponent(Number(session.total_amount).toFixed(2))}` +
      `&transaction_uuid=${encodeURIComponent(session.transaction_uuid)}`;

    let statusPayload = null;
    try {
      const response = await fetch(checkUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (response.ok) statusPayload = await response.json();
    } catch (fetchErr) {
      console.error("Error checking eSewa guide payment status:", fetchErr);
    }

    const paymentStatus = parseEsewaStatusPayload(statusPayload);

    if (!isEsewaSuccessStatus(paymentStatus)) {
      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "esewa", verify_payload: statusPayload || null }), session.session_id]
      );

      await client.query("COMMIT");
      return res.status(400).json({ message: "Payment not completed yet or verification failed" });
    }

    const bookingCreation = await createGuideBookingFromPaymentSession({
      client,
      session,
      touristId,
    });

    if (bookingCreation.error) {
      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "esewa", booking_error: bookingCreation.error }), session.session_id]
      );

      await client.query("COMMIT");
      return res.status(bookingCreation.status).json({ message: bookingCreation.error });
    }

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $2::jsonb,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $3`,
      [
        bookingCreation.booking.booking_id,
        JSON.stringify({ provider: "esewa", verify_payload: statusPayload || null }),
        session.session_id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Guide package payment verified and booking created successfully.",
      booking: bookingCreation.booking,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error verifying guide package payment:", err);
    return res.status(500).json({ message: "Server error verifying guide package payment" });
  } finally {
    client.release();
  }
};

export const getGuidePaymentSessionStatus = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const sessionToken = String(req.params.sessionToken || "").trim();

    if (!sessionToken) {
      return res.status(400).json({ message: "sessionToken is required" });
    }

    const result = await pool.query(
      `SELECT gps.session_id, gps.session_token, gps.payment_status, gps.transaction_uuid,
              gps.total_amount, gps.verified_at, gps.created_at,
              gps.service_id, gs.title AS service_title,
              gps.guide_id, g.full_name AS guide_name,
              gps.trail_id, t.trail_name,
              b.booking_id, b.booking_code
       FROM guide_package_payment_sessions gps
       LEFT JOIN guide_package_bookings b ON gps.booking_id = b.booking_id
       LEFT JOIN guide_services gs ON gps.service_id = gs.service_id
       LEFT JOIN guides g ON gps.guide_id = g.guide_id
       LEFT JOIN trekking_trails t ON gps.trail_id = t.trail_id
       WHERE gps.session_token = $1
         AND gps.tourist_id = $2`,
      [sessionToken, touristId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Guide payment session not found" });
    }

    return res.status(200).json({ payment: result.rows[0] });
  } catch (err) {
    console.error("Error fetching guide payment session status:", err);
    return res.status(500).json({ message: "Server error fetching guide payment status" });
  }
};

export const submitGuideReview = async (req, res) => {
  const client = await pool.connect();

  try {
    await processExpiredPendingGuideBookings();

    const touristId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    const rating = Number.parseInt(req.body?.rating, 10);
    const comment = String(req.body?.comment || "").trim();

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }

    if (comment.length > 1500) {
      return res.status(400).json({ message: "comment must be 1500 characters or less" });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.booking_id, b.guide_id, b.tourist_id, b.status, b.end_date,
              g.full_name AS guide_name,
              ps.payment_status,
              r.review_id
       FROM guide_package_bookings b
       JOIN guides g ON g.guide_id = b.guide_id
       LEFT JOIN LATERAL (
         SELECT payment_status
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_reviews r ON r.booking_id = b.booking_id
       WHERE b.booking_id = $1
       FOR UPDATE OF b`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Guide booking not found" });
    }

    const booking = bookingResult.rows[0];

    if (booking.tourist_id !== touristId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can only review your own guide booking" });
    }

    if (booking.status !== "confirmed") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Only confirmed guide bookings can be reviewed" });
    }

    const paymentStatus = String(booking.payment_status || "").trim().toLowerCase();
    if (paymentStatus !== "success") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Only paid and successful guide bookings can be reviewed" });
    }

    if (booking.review_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "You have already reviewed this guide booking" });
    }

    const endParsed = parseDateOnly(booking.end_date, "end_date");
    if (endParsed.error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Booking end date is invalid" });
    }

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    if (todayUtc <= endParsed.value) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Review can be submitted only after trek end date has passed",
      });
    }

    const reviewResult = await client.query(
      `INSERT INTO guide_reviews
        (guide_id, user_id, booking_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING review_id, guide_id, booking_id, rating, comment, created_at`,
      [
        booking.guide_id,
        touristId,
        bookingId,
        rating,
        comment || null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Thank you! Your guide review has been submitted.",
      review: reviewResult.rows[0],
      guide_name: booking.guide_name,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error submitting guide review:", err);
    return res.status(500).json({ message: "Server error submitting guide review" });
  } finally {
    client.release();
  }
};

export const getMyGuideBookings = async (req, res) => {
  try {
    await processExpiredPendingGuideBookings();
    const touristId = req.user.user_id;

    const result = await pool.query(
            `SELECT b.booking_id, b.booking_code, b.start_date, b.end_date, b.participants_count,
              b.contact_phone, b.special_requests, b.status, b.total_price, b.created_at,
              b.approval_deadline_at, b.decided_at,
              gs.service_id, gs.title AS service_title,
              g.guide_id, g.full_name AS guide_name,
              t.trail_id, t.trail_name,
              gr.review_id, gr.rating AS review_rating, gr.comment AS review_comment, gr.created_at AS review_created_at,
              (
                b.status = 'confirmed'
                AND COALESCE(LOWER(ps.payment_status), '') = 'success'
                AND CURRENT_DATE > b.end_date
                AND gr.review_id IS NULL
              ) AS can_review,
              ps.payment_status,
              CASE WHEN rf.refund_status = 'processed' THEN 'refunded' ELSE rf.refund_status END AS refund_status,
              rf.requested_amount AS refund_requested_amount,
              rf.approved_amount AS refund_approved_amount,
              rf.requested_at AS refund_requested_at,
              rf.processed_at AS refunded_at,
              rf.gateway_refund_reference AS refund_reference
       FROM guide_package_bookings b
       JOIN guide_services gs ON b.service_id = gs.service_id
       JOIN guides g ON b.guide_id = g.guide_id
       JOIN trekking_trails t ON b.trail_id = t.trail_id
       LEFT JOIN LATERAL (
         SELECT payment_status
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_booking_refunds rf ON rf.booking_id = b.booking_id
       LEFT JOIN guide_reviews gr ON gr.booking_id = b.booking_id
       WHERE b.tourist_id = $1
       ORDER BY b.created_at DESC`,
      [touristId]
    );

    const bookings = result.rows.map((booking) => {
      const bookingStatus = String(booking.status || "").trim().toLowerCase();
      const paymentStatus = String(booking.payment_status || "").trim().toLowerCase();
      const refundStatus = normalizeGuideRefundStatus(booking.refund_status);
      const chatAccess = resolveGuideBookingChatAccess({
        bookingStatus,
        paymentStatus,
        endDate: booking.end_date,
      });

      const policy = evaluateGuideRefundPolicy({
        startDate: booking.start_date,
        paidAmount: booking.total_price,
      });

      const isClosed =
        ["cancelled", "rejected", "expired", "refunded"].includes(bookingStatus) ||
        refundStatus === "refunded" ||
        paymentStatus === "refunded";

      const isRefundPending =
        bookingStatus === "refund_requested" ||
        ["requested", "processing"].includes(refundStatus) ||
        paymentStatus === "refund_requested";

      const refundEligible =
        bookingStatus === "confirmed" &&
        paymentStatus === "success" &&
        !isClosed &&
        !isRefundPending &&
        policy.eligible;

      return {
        ...booking,
        refund_eligible: refundEligible,
        refund_rule_code: policy.ruleCode,
        refund_reason: policy.reason,
        refund_amount_preview: policy.refundAmount,
        refund_rate_preview: policy.refundRate,
        hours_until_start_date: policy.hoursUntilStartDate,
        can_chat: chatAccess.canChat,
        chat_expires_at: chatAccess.chatExpiresAt ? chatAccess.chatExpiresAt.toISOString() : null,
        chat_access_reason: chatAccess.reason,
      };
    });

    return res.status(200).json({ bookings });
  } catch (err) {
    console.error("Error fetching tourist guide bookings:", err);
    return res.status(500).json({ message: "Server error fetching guide bookings" });
  }
};

export const getGuideProviderBookings = async (req, res) => {
  try {
    await processExpiredPendingGuideBookings();
    const guideId = req.user.user_id;

    const result = await pool.query(
            `SELECT b.booking_id, b.booking_code, b.start_date, b.end_date, b.participants_count,
              b.contact_phone, b.special_requests, b.status, b.total_price, b.created_at,
              b.approval_deadline_at, b.decided_at,
              gs.service_id, gs.title AS service_title,
              t.trail_id, t.trail_name,
              tr.full_name AS tourist_name,
              gr.review_id, gr.rating AS review_rating, gr.comment AS review_comment, gr.created_at AS review_created_at,
              ps.payment_status,
              CASE WHEN rf.refund_status = 'processed' THEN 'refunded' ELSE rf.refund_status END AS refund_status,
              rf.requested_amount AS refund_requested_amount,
              rf.gateway_refund_reference AS refund_reference
       FROM guide_package_bookings b
       JOIN guide_services gs ON b.service_id = gs.service_id
       JOIN trekking_trails t ON b.trail_id = t.trail_id
       JOIN tourists tr ON b.tourist_id = tr.tourist_id
       LEFT JOIN LATERAL (
         SELECT payment_status
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_booking_refunds rf ON rf.booking_id = b.booking_id
       LEFT JOIN guide_reviews gr ON gr.booking_id = b.booking_id
       WHERE b.guide_id = $1
       ORDER BY b.created_at DESC`,
      [guideId]
    );

    return res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error("Error fetching guide provider bookings:", err);
    return res.status(500).json({ message: "Server error fetching package bookings" });
  }
};

export const updateGuideBookingStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await processExpiredPendingGuideBookings();

    const guideId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim() || null;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!["confirmed", "rejected", "cancelled"].includes(nextStatus)) {
      return res.status(400).json({ message: "status must be one of confirmed, rejected, cancelled" });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.booking_id, b.guide_id, b.tourist_id, b.status, b.total_price,
              ps.session_id, ps.payment_status, ps.payment_ref_id, ps.transaction_uuid,
              rf.refund_status
       FROM guide_package_bookings b
       LEFT JOIN LATERAL (
         SELECT session_id, payment_status, payment_ref_id, transaction_uuid
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_booking_refunds rf ON rf.booking_id = b.booking_id
       WHERE b.booking_id = $1
       FOR UPDATE OF b`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    if (Number(booking.guide_id) !== Number(guideId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can update only your own guide bookings" });
    }

    const currentStatus = String(booking.status || "").trim().toLowerCase();
    const refundStatus = normalizeGuideRefundStatus(booking.refund_status);

    if (currentStatus === "refunded") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Refunded booking cannot be updated" });
    }

    if (currentStatus === "expired") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Booking already expired due to approval timeout" });
    }

    if (nextStatus === "confirmed") {
      if (currentStatus !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Only pending bookings can be confirmed" });
      }

      await client.query(
        `UPDATE guide_package_bookings
         SET status = 'confirmed',
             decided_at = CURRENT_TIMESTAMP,
             cancelled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1`,
        [bookingId]
      );

      await logGuideTimelineEvent(client, {
        bookingId,
        actorRole: "guide",
        actorUserId: guideId,
        action: "guide_confirmed_booking",
        fromStatus: currentStatus,
        toStatus: "confirmed",
        note,
      });

      await client.query("COMMIT");
      return res.status(200).json({ message: "Guide booking marked as confirmed" });
    }

    if (nextStatus === "rejected" && currentStatus !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Only pending bookings can be rejected" });
    }

    // Once a guide has confirmed a booking, provider-side cancellation is not allowed.
    if (nextStatus === "cancelled" && currentStatus === "confirmed") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Confirmed guide bookings cannot be cancelled by the guide. Tourist refund workflow should be used if needed.",
      });
    }

    if (currentStatus === "refund_requested") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Refund review is already pending for this booking" });
    }

    const paymentStatus = String(booking.payment_status || "").trim().toLowerCase();
    const hasPaidSession = paymentStatus === "success" || paymentStatus === "refund_requested";
    const provider =
      (String(booking.transaction_uuid || "").toUpperCase().startsWith("GSPAY-") ? "stripe" : "esewa");

    if (hasPaidSession) {
      if (["requested", "processing", "refunded"].includes(refundStatus)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: `Refund status is already ${refundStatus} for this booking` });
      }

      await client.query(
        `UPDATE guide_package_bookings
         SET status = $2,
             decided_at = CURRENT_TIMESTAMP,
             cancelled_at = CASE WHEN $2 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1`,
        [bookingId, nextStatus]
      );

      await logGuideTimelineEvent(client, {
        bookingId,
        actorRole: "guide",
        actorUserId: guideId,
        action: nextStatus === "rejected" ? "guide_rejected_booking" : "guide_cancelled_booking",
        fromStatus: currentStatus,
        toStatus: nextStatus,
        note,
      });

      const refundResult = await createGuideRefundWithOptionalAutoProcess({
        client,
        bookingId,
        sessionId: booking.session_id,
        touristId: booking.tourist_id,
        amount: booking.total_price,
        provider,
        paymentReference: booking.payment_ref_id,
        reason:
          note ||
          (nextStatus === "rejected"
            ? "Guide rejected the booking request."
            : "Guide cancelled the booking after acceptance."),
        policyRule: nextStatus === "rejected" ? "guide_rejected_by_provider" : "guide_cancelled_by_provider",
        actorRole: "guide",
        actorUserId: guideId,
        note,
      });

      await client.query("COMMIT");
      return res.status(200).json({
        message:
          refundResult.refundStatus === "refunded"
            ? "Booking updated and refund completed."
            : "Booking updated and refund is now processing.",
      });
    }

    await client.query(
      `UPDATE guide_package_bookings
       SET status = $2,
           decided_at = CURRENT_TIMESTAMP,
           cancelled_at = CASE WHEN $2 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId, nextStatus]
    );

    await logGuideTimelineEvent(client, {
      bookingId,
      actorRole: "guide",
      actorUserId: guideId,
      action: nextStatus === "rejected" ? "guide_rejected_booking" : "guide_cancelled_booking",
      fromStatus: currentStatus,
      toStatus: nextStatus,
      note,
    });

    await client.query("COMMIT");
    return res.status(200).json({ message: `Guide booking marked as ${nextStatus}` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating guide booking status:", err);
    return res.status(500).json({ message: "Server error updating guide booking status" });
  } finally {
    client.release();
  }
};

export const requestGuideBookingRefund = async (req, res) => {
  const client = await pool.connect();

  try {
    await processExpiredPendingGuideBookings();

    const touristId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    const reason = String(req.body?.reason || "").trim() || null;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
            `SELECT b.booking_id, b.tourist_id, b.status, b.total_price, b.start_date,
              ps.session_id, ps.payment_status, ps.payment_ref_id, ps.transaction_uuid,
              rf.refund_status
       FROM guide_package_bookings b
       LEFT JOIN LATERAL (
         SELECT session_id, payment_status, payment_ref_id, transaction_uuid
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) ps ON true
       LEFT JOIN guide_booking_refunds rf ON rf.booking_id = b.booking_id
       WHERE b.booking_id = $1
       FOR UPDATE OF b`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Guide booking not found" });
    }

    const booking = bookingResult.rows[0];
    const bookingStatus = String(booking.status || "").trim().toLowerCase();
    if (Number(booking.tourist_id) !== Number(touristId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can request refund only for your own guide bookings" });
    }

    if (bookingStatus !== "confirmed") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Only confirmed guide bookings are eligible for tourist refund requests.",
        refund_eligible: false,
        rule_code: "invalid_booking_status",
      });
    }

    const existingRefundStatus = normalizeGuideRefundStatus(booking.refund_status);

    if (bookingStatus === "refunded" || existingRefundStatus === "refunded") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Booking is already refunded" });
    }

    if (bookingStatus === "refund_requested" || ["requested", "processing"].includes(existingRefundStatus)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Refund request is already pending for this booking" });
    }

    const paymentStatus = String(booking.payment_status || "").trim().toLowerCase();
    if (paymentStatus !== "success") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Refund requires a successful payment" });
    }

    const policy = evaluateGuideRefundPolicy({
      startDate: booking.start_date,
      paidAmount: booking.total_price,
    });

    if (!policy.eligible) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: policy.reason,
        refund_eligible: false,
        rule_code: policy.ruleCode,
      });
    }

    const provider =
      (String(booking.transaction_uuid || "").toUpperCase().startsWith("GSPAY-") ? "stripe" : "esewa");

    await client.query(
      `INSERT INTO guide_booking_refunds
        (booking_id, session_id, tourist_id, requested_amount, approved_amount, currency,
         refund_reason, policy_rule, refund_status, provider, requested_at, updated_at)
       VALUES
        ($1, $2, $3, $4, $4, 'NPR', $5, $6, 'requested', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (booking_id)
       DO UPDATE SET session_id = EXCLUDED.session_id,
                     tourist_id = EXCLUDED.tourist_id,
                     requested_amount = EXCLUDED.requested_amount,
                     approved_amount = EXCLUDED.approved_amount,
                     refund_reason = EXCLUDED.refund_reason,
                     policy_rule = EXCLUDED.policy_rule,
                     refund_status = 'requested',
                     provider = EXCLUDED.provider,
                     requested_at = CURRENT_TIMESTAMP,
                     reviewed_at = NULL,
                     processed_at = NULL,
                     reviewed_by_user_id = NULL,
                     review_note = NULL,
                     gateway_refund_reference = NULL,
                     gateway_response = NULL,
                     updated_at = CURRENT_TIMESTAMP`,
      [
        bookingId,
        booking.session_id || null,
        touristId,
        policy.refundAmount,
        reason,
        `tourist_requested_${policy.ruleCode}`,
        provider,
      ]
    );

    await client.query(
      `UPDATE guide_package_bookings
       SET status = 'refund_requested',
           decided_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = 'refund_requested',
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1
         AND payment_status IN ('success', 'refund_requested')`,
      [bookingId]
    );

    await logGuideTimelineEvent(client, {
      bookingId,
      actorRole: "tourist",
      actorUserId: touristId,
      action: "tourist_requested_refund",
      fromStatus: String(booking.status || "").toLowerCase(),
      toStatus: "refund_requested",
      note: reason,
      metadata: {
        provider,
        payment_reference: booking.payment_ref_id || null,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: "Guide booking refund request submitted.",
      refund: {
        booking_id: bookingId,
        requested_amount: policy.refundAmount,
        refund_rate: policy.refundRate,
        rule_code: policy.ruleCode,
        hours_until_start_date: policy.hoursUntilStartDate,
        provider,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error requesting guide booking refund:", err);
    const errorResponse = buildGuideRefundExceptionResponse(err, "request");
    return res.status(errorResponse.status).json({
      message: errorResponse.message,
      code: errorResponse.code,
    });
  } finally {
    client.release();
  }
};

export const getAdminGuideBookingPayments = async (req, res) => {
  try {
    await processExpiredPendingGuideBookings();
    const pageRaw = Number.parseInt(req.query.page, 10);
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const requestedPage = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

    const [countResult, summaryResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM guide_package_payment_sessions`),
      pool.query(
        `SELECT
           COUNT(*)::int AS total_sessions,
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(gps.payment_status, '')) = 'success'
           )::int AS successful_count,
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(gr.refund_status, '')) IN ('requested', 'processing')
                OR LOWER(COALESCE(gps.payment_status, '')) = 'refund_requested'
           )::int AS pending_refunds,
           COALESCE(
             SUM(
               CASE
                 WHEN LOWER(COALESCE(gps.payment_status, '')) = 'success'
                 THEN COALESCE(gps.total_amount, 0)
                 ELSE 0
               END
             ),
             0
           )::numeric AS settled_volume
         FROM guide_package_payment_sessions gps
         LEFT JOIN guide_package_bookings b ON gps.booking_id = b.booking_id
         LEFT JOIN guide_booking_refunds gr ON gr.booking_id = b.booking_id`
      ),
    ]);

    const totalRecords = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT gps.session_id, gps.session_token, gps.payment_status,
              gps.transaction_uuid, gps.payment_ref_id,
              COALESCE(gps.payment_response->>'provider', CASE WHEN gps.transaction_uuid LIKE 'GSPAY-%' THEN 'stripe' ELSE 'esewa' END) AS payment_provider,
              gps.total_amount, gps.created_at AS payment_initiated_at, gps.verified_at,
              b.booking_id, b.booking_code, b.status AS booking_status,
              CASE WHEN gr.refund_status = 'processed' THEN 'refunded' ELSE gr.refund_status END AS refund_status,
              gr.requested_amount AS refund_requested_amount,
              gr.approved_amount AS refund_approved_amount,
              gr.requested_at AS refund_requested_at, gr.processed_at AS refunded_at,
              gr.gateway_refund_reference,
              gs.service_id, gs.title AS service_title,
              t.trail_name,
              tr.full_name AS tourist_name, tr.email AS tourist_email,
              g.full_name AS guide_name, g.email AS guide_email
       FROM guide_package_payment_sessions gps
       LEFT JOIN guide_package_bookings b ON gps.booking_id = b.booking_id
       LEFT JOIN guide_booking_refunds gr ON gr.booking_id = b.booking_id
       JOIN guide_services gs ON gps.service_id = gs.service_id
       JOIN trekking_trails t ON gps.trail_id = t.trail_id
       JOIN tourists tr ON gps.tourist_id = tr.tourist_id
       JOIN guides g ON gps.guide_id = g.guide_id
       ORDER BY gps.created_at DESC
       LIMIT $1
       OFFSET $2`,
      [limit, offset]
    );

    return res.status(200).json({
      records: result.rows,
      summary: {
        total_sessions: Number(summaryResult.rows[0]?.total_sessions || 0),
        successful_count: Number(summaryResult.rows[0]?.successful_count || 0),
        pending_refunds: Number(summaryResult.rows[0]?.pending_refunds || 0),
        settled_volume: Number(summaryResult.rows[0]?.settled_volume || 0),
      },
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
      },
    });
  } catch (err) {
    console.error("Error fetching admin guide payment records:", err);
    return res.status(500).json({ message: "Server error fetching guide payment records" });
  }
};

export const reviewGuideBookingRefund = async (req, res) => {
  const client = await pool.connect();

  try {
    await processExpiredPendingGuideBookings();

    const adminUserId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    const action = String(req.body?.action || "").trim().toLowerCase();
    const reviewNote = String(req.body?.note || "").trim() || null;
    let gatewayRefundReference = String(req.body?.gateway_refund_reference || "").trim() || null;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!["process", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be either process or reject" });
    }

    await client.query("BEGIN");

    const refundResult = await client.query(
      `SELECT gr.refund_id, gr.refund_status, gr.requested_amount, gr.provider, gr.policy_rule,
              gps.payment_ref_id
       FROM guide_booking_refunds gr
       JOIN guide_package_bookings b ON gr.booking_id = b.booking_id
       LEFT JOIN LATERAL (
         SELECT payment_ref_id
         FROM guide_package_payment_sessions
         WHERE booking_id = b.booking_id
         ORDER BY created_at DESC
         LIMIT 1
       ) gps ON true
       WHERE gr.booking_id = $1
       FOR UPDATE OF gr, b`,
      [bookingId]
    );

    if (!refundResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Guide refund request not found" });
    }

    const refund = refundResult.rows[0];
    const currentRefundStatus = normalizeGuideRefundStatus(refund.refund_status);

    if (!["requested", "processing"].includes(currentRefundStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Refund request is already ${currentRefundStatus}` });
    }

    if (action === "reject") {
      if (String(refund.policy_rule || "").startsWith("guide_")) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Guide-side rejection/cancellation/expiry refunds cannot be rejected by admin policy.",
        });
      }

      await client.query(
        `UPDATE guide_booking_refunds
         SET refund_status = 'rejected',
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_by_user_id = $2,
             review_note = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE refund_id = $1`,
        [refund.refund_id, adminUserId, reviewNote]
      );

      await client.query(
        `UPDATE guide_package_bookings
         SET status = 'confirmed',
             decided_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1`,
        [bookingId]
      );

      await client.query(
        `UPDATE guide_package_payment_sessions
         SET payment_status = 'success',
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = $1
           AND payment_status = 'refund_requested'`,
        [bookingId]
      );

      await logGuideTimelineEvent(client, {
        bookingId,
        actorRole: "admin",
        actorUserId: adminUserId,
        action: "admin_rejected_refund",
        fromStatus: "refund_requested",
        toStatus: "confirmed",
        note: reviewNote,
      });

      await client.query("COMMIT");
      return res.status(200).json({ message: "Guide refund request rejected." });
    }

    const provider = String(refund.provider || "").trim().toLowerCase() || "unknown";
    const paymentReference = String(refund.payment_ref_id || "").trim();
    let gatewayResponse = null;

    if (provider === "stripe" && stripeClient && paymentReference.startsWith("pi_")) {
      try {
        const stripeRefund = await stripeClient.refunds.create({ payment_intent: paymentReference });
        if (stripeRefund.status !== "succeeded") {
          await client.query("ROLLBACK");
          return res.status(502).json({
            message: `Stripe refund is not completed yet (status: ${stripeRefund.status}). Please retry after confirmation.`,
          });
        }

        gatewayRefundReference = stripeRefund.id;
        gatewayResponse = {
          provider: "stripe",
          refund_id: stripeRefund.id,
          refund_status: stripeRefund.status,
          payment_intent: paymentReference,
          amount_minor: stripeRefund.amount,
          currency: stripeRefund.currency,
        };
      } catch (stripeErr) {
        await client.query("ROLLBACK");
        console.error("Error processing Stripe guide refund:", stripeErr);
        return res.status(502).json({
          message: stripeErr?.message || "Stripe refund failed. Try again or process manually.",
        });
      }
    } else if (!gatewayRefundReference) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "gateway_refund_reference is required for non-Stripe automatic refunds",
      });
    }

    await client.query(
      `UPDATE guide_booking_refunds
       SET refund_status = 'refunded',
           processed_at = CURRENT_TIMESTAMP,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by_user_id = $2,
           review_note = $3,
           gateway_refund_reference = $4,
           gateway_response = $5::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE refund_id = $1`,
      [
        refund.refund_id,
        adminUserId,
        reviewNote,
        gatewayRefundReference,
        gatewayResponse ? JSON.stringify(gatewayResponse) : null,
      ]
    );

    await client.query(
      `UPDATE guide_package_bookings
       SET status = CASE WHEN status = 'refund_requested' THEN 'refunded' ELSE status END,
         decided_at = CURRENT_TIMESTAMP,
         cancelled_at = CASE WHEN status = 'cancelled' THEN COALESCE(cancelled_at, CURRENT_TIMESTAMP) ELSE cancelled_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    await client.query(
      `UPDATE guide_package_payment_sessions
       SET payment_status = 'refunded',
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1
         AND payment_status IN ('success', 'refund_requested')`,
      [bookingId]
    );

    await logGuideTimelineEvent(client, {
      bookingId,
      actorRole: "admin",
      actorUserId: adminUserId,
      action: "admin_processed_refund",
      fromStatus: "refund_requested",
      toStatus: "refunded",
      note: reviewNote,
      metadata: {
        gateway_refund_reference: gatewayRefundReference,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json({ message: "Guide booking refund processed successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error reviewing guide booking refund:", err);
    const errorResponse = buildGuideRefundExceptionResponse(err, "review");
    return res.status(errorResponse.status).json({
      message: errorResponse.message,
      code: errorResponse.code,
    });
  } finally {
    client.release();
  }
};

export const getGuideBookingTimeline = async (req, res) => {
  try {
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const bookingResult = await pool.query(
      `SELECT booking_id, guide_id, tourist_id
       FROM guide_package_bookings
       WHERE booking_id = $1`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      return res.status(404).json({ message: "Guide booking not found" });
    }

    const booking = bookingResult.rows[0];
    const requesterId = Number(req.user.user_id);
    const requesterRole = String(req.user.user_type || "").toLowerCase();

    const allowed =
      requesterRole === "admin" ||
      (requesterRole === "tourist" && requesterId === Number(booking.tourist_id)) ||
      (requesterRole === "guide" && requesterId === Number(booking.guide_id));

    if (!allowed) {
      return res.status(403).json({ message: "Not authorized to view this booking timeline" });
    }

    const timelineResult = await pool.query(
      `SELECT event_id, actor_role, actor_user_id, action, from_status, to_status,
              note, metadata, created_at
       FROM guide_booking_timeline
       WHERE booking_id = $1
       ORDER BY created_at DESC, event_id DESC`,
      [bookingId]
    );

    return res.status(200).json({ timeline: timelineResult.rows });
  } catch (err) {
    console.error("Error fetching guide booking timeline:", err);
    return res.status(500).json({ message: "Server error fetching guide booking timeline" });
  }
};
