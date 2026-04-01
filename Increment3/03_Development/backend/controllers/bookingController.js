import pool from "../config/db.js";
import crypto from "crypto";
import Stripe from "stripe";

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldName} must be a positive integer`, value: null };
  }
  return { error: null, value: parsed };
};

const parseDateOnly = (value, fieldName) => {
  if (!value) {
    return { error: `${fieldName} is required`, value: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { error: `${fieldName} is invalid`, value: null };
    }
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return { error: null, value: normalized };
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${fieldName} is invalid`, value: null };
  }

  return { error: null, value: parsed };
};

const toDateOnly = (date) => date.toISOString().slice(0, 10);

const generateBookingCode = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `OTB-${stamp}-${rand}`;
};

const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
const ESEWA_PAYMENT_URL = process.env.ESEWA_PAYMENT_URL || "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_STATUS_CHECK_URL = process.env.ESEWA_STATUS_CHECK_URL || "https://rc-epay.esewa.com.np/api/epay/transaction/status/";
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";
const SERVER_PUBLIC_BASE_URL = process.env.SERVER_PUBLIC_BASE_URL || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_MIN_USD_CENTS = Number(process.env.STRIPE_MIN_USD_CENTS || 50);
const STRIPE_USD_TO_NPR_FALLBACK = Number(process.env.STRIPE_USD_TO_NPR_FALLBACK || 150.08);
const STRIPE_FX_API_URL = process.env.STRIPE_FX_API_URL || "https://open.er-api.com/v6/latest/USD";
const STRIPE_FX_CACHE_TTL_MS = Number(process.env.STRIPE_FX_CACHE_TTL_MS || 60 * 60 * 1000);
const stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
let stripeFxCache = {
  usdToNprRate: null,
  fetchedAtMs: 0,
};

const toMoney = (value) => Number.parseFloat(Number(value).toFixed(2));

const convertNprToMinorUnits = (nprAmount) => {
  return Math.max(1, Math.round(Number(nprAmount) * 100));
};

const convertNprToUsdCents = (nprAmount, usdToNprRate) => {
  const convertedUsd = Number(nprAmount) / Number(usdToNprRate);
  return Math.max(STRIPE_MIN_USD_CENTS, Math.round(convertedUsd * 100));
};

const extractUsdToNprRate = (payload) => {
  const directRates = payload?.rates || payload?.conversion_rates || null;
  const rate = Number(directRates?.NPR);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
};

const getStripeUsdToNprRate = async () => {
  // Always use the configured fallback rate (150.08) for accurate NPR pricing
  // This ensures consistent payment amounts across all payment methods
  return {
    usdToNprRate: STRIPE_USD_TO_NPR_FALLBACK,
    source: "configured",
  };
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
  if (SERVER_PUBLIC_BASE_URL) {
    return SERVER_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
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

const getPaymentFailureRedirectUrl = ({ homestayId, sessionToken, reason }) => {
  const safeHomestayId = homestayId || null;
  const params = new URLSearchParams();
  params.set("payment", "failed");
  if (sessionToken) params.set("session_token", sessionToken);
  if (reason) params.set("reason", reason);
  if (!safeHomestayId) {
    return `${CLIENT_BASE_URL}/?${params.toString()}`;
  }
  return `${CLIENT_BASE_URL}/homestays/${safeHomestayId}?${params.toString()}`;
};

const getPaymentSuccessRedirectUrl = ({ homestayId, sessionToken }) => {
  const params = new URLSearchParams();
  params.set("payment", "success");
  if (sessionToken) params.set("session_token", sessionToken);
  if (homestayId) params.set("homestay_id", String(homestayId));
  return `${CLIENT_BASE_URL}/payment/success?${params.toString()}`;
};

const getSessionByTokenOrTransaction = async ({ sessionToken, transactionUuid }) => {
  if (sessionToken) {
    const byToken = await pool.query(
      `SELECT * FROM booking_payment_sessions WHERE session_token = $1`,
      [sessionToken]
    );
    if (byToken.rows.length) return byToken.rows[0];
  }

  if (transactionUuid) {
    const byTransaction = await pool.query(
      `SELECT * FROM booking_payment_sessions WHERE transaction_uuid = $1`,
      [transactionUuid]
    );
    if (byTransaction.rows.length) return byTransaction.rows[0];
  }

  return null;
};

const inferPaymentProviderFromSession = (session) => {
  const providerFromResponse =
    session?.payment_response &&
    typeof session.payment_response === "object" &&
    !Array.isArray(session.payment_response)
      ? String(session.payment_response.provider || "").trim().toLowerCase()
      : "";

  if (providerFromResponse) return providerFromResponse;

  const transactionUuid = String(session?.transaction_uuid || "").toUpperCase();
  if (transactionUuid.startsWith("STPAY-")) return "stripe";
  return "esewa";
};

const upsertPaymentLedgerRecord = async ({ client, session, bookingId, paymentRefId }) => {
  if (!bookingId) return;

  const amount = toMoney(session.total_amount ?? session.amount ?? 0);
  const paymentMethod = inferPaymentProviderFromSession(session);
  const transactionReference = paymentRefId || session.payment_ref_id || session.transaction_uuid || null;
  const paidAt = session.verified_at || new Date();

  const updated = await client.query(
    `UPDATE payments
     SET amount = $2,
         payment_method = $3,
         payment_status = $4,
         transaction_reference = COALESCE($5, transaction_reference),
         paid_at = COALESCE($6, paid_at, CURRENT_TIMESTAMP)
     WHERE booking_id = $1`,
    [bookingId, amount, paymentMethod, "success", transactionReference, paidAt]
  );

  if (updated.rowCount === 0) {
    await client.query(
      `INSERT INTO payments
        (booking_id, amount, payment_method, payment_status, transaction_reference, paid_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP))`,
      [bookingId, amount, paymentMethod, "success", transactionReference, paidAt]
    );
  }
};

const getValidatedBookingDraft = async ({
  client,
  homestayId,
  checkInDate,
  checkOutDate,
  roomsBooked,
  guestsCount,
  lockHomestay,
}) => {
  const homestayQuery = `SELECT homestay_id, host_id, name, location, price_per_night, capacity, total_rooms, available_rooms
     FROM homestays
     WHERE homestay_id = $1
       AND verified_status = 'approved'
       AND is_active = true
     ${lockHomestay ? "FOR UPDATE" : ""}`;

  const homestayResult = await client.query(homestayQuery, [homestayId]);

  if (!homestayResult.rows.length) {
    return { error: "Homestay not available for booking", status: 404 };
  }

  const homestay = homestayResult.rows[0];

  if (roomsBooked > Number(homestay.available_rooms || 0)) {
    return { error: "Not enough rooms available for selected booking", status: 400 };
  }

  if (guestsCount > Number(homestay.capacity || 0) * roomsBooked) {
    return { error: "Guest count exceeds allowed capacity for selected rooms", status: 400 };
  }

  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
  const totalPrice = toMoney(Number(homestay.price_per_night) * roomsBooked * nights);

  return {
    error: null,
    status: 200,
    homestay,
    nights,
    totalPrice,
  };
};

const createBookingFromPaymentSession = async ({ client, session, touristId }) => {
  const checkInDate = parseDateOnly(session.check_in_date, "check_in_date");
  const checkOutDate = parseDateOnly(session.check_out_date, "check_out_date");

  if (checkInDate.error || checkOutDate.error) {
    return { error: "Invalid booking dates in payment session", status: 400 };
  }

  const draft = await getValidatedBookingDraft({
    client,
    homestayId: session.homestay_id,
    checkInDate: checkInDate.value,
    checkOutDate: checkOutDate.value,
    roomsBooked: session.rooms_booked,
    guestsCount: session.guests_count,
    lockHomestay: true,
  });

  if (draft.error) {
    return { error: draft.error, status: draft.status };
  }

  const expectedAmount = toMoney(session.amount);
  if (toMoney(draft.totalPrice) !== expectedAmount) {
    return {
      error: "Booking price changed before payment verification. Please initiate payment again.",
      status: 409,
    };
  }

  const bookingResult = await client.query(
    `INSERT INTO homestay_bookings
      (booking_code, homestay_id, host_id, tourist_id, check_in_date, check_out_date, rooms_booked, guests_count, contact_phone, special_requests, status, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)
     RETURNING *`,
    [
      generateBookingCode(),
      session.homestay_id,
      session.host_id,
      touristId,
      toDateOnly(checkInDate.value),
      toDateOnly(checkOutDate.value),
      session.rooms_booked,
      session.guests_count,
      session.contact_phone || null,
      session.special_requests || null,
      expectedAmount,
    ]
  );

  await client.query(
    `UPDATE homestays
     SET available_rooms = available_rooms - $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE homestay_id = $2`,
    [session.rooms_booked, session.homestay_id]
  );

  const booking = bookingResult.rows[0];
  return {
    error: null,
    status: 201,
    booking: {
      ...booking,
      nights: draft.nights,
      homestay_name: draft.homestay.name,
      homestay_location: draft.homestay.location,
    },
  };
};

const createGuaranteedBookingFromPaidSession = async ({ client, session, touristId }) => {
  const homestayResult = await client.query(
    `SELECT homestay_id, host_id, name, location, available_rooms, total_rooms
     FROM homestays
     WHERE homestay_id = $1
     FOR UPDATE`,
    [session.homestay_id]
  );

  if (!homestayResult.rows.length) {
    return { error: "Homestay no longer exists", status: 404 };
  }

  const homestay = homestayResult.rows[0];

  const checkInDate = parseDateOnly(session.check_in_date, "check_in_date");
  const checkOutDate = parseDateOnly(session.check_out_date, "check_out_date");
  if (checkInDate.error || checkOutDate.error) {
    return { error: "Invalid booking dates in payment session", status: 400 };
  }

  const bookingResult = await client.query(
    `INSERT INTO homestay_bookings
      (booking_code, homestay_id, host_id, tourist_id, check_in_date, check_out_date, rooms_booked, guests_count, contact_phone, special_requests, status, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)
     RETURNING *`,
    [
      generateBookingCode(),
      session.homestay_id,
      session.host_id,
      touristId,
      toDateOnly(checkInDate.value),
      toDateOnly(checkOutDate.value),
      session.rooms_booked,
      session.guests_count,
      session.contact_phone || null,
      session.special_requests || null,
      toMoney(session.amount),
    ]
  );

  await client.query(
    `UPDATE homestays
     SET available_rooms = GREATEST(0, available_rooms - $1),
         updated_at = CURRENT_TIMESTAMP
     WHERE homestay_id = $2`,
    [session.rooms_booked, session.homestay_id]
  );

  const booking = bookingResult.rows[0];
  const nights = Math.max(1, Math.ceil((checkOutDate.value.getTime() - checkInDate.value.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    error: null,
    status: 201,
    booking: {
      ...booking,
      nights,
      homestay_name: homestay.name,
      homestay_location: homestay.location,
      fallback_applied: true,
    },
  };
};

export const createHomestayBooking = async (req, res) => {
  return res.status(410).json({
    message: "Direct booking is disabled. Complete payment first via /api/bookings/payment/initiate.",
  });
};

export const initiateEsewaPaymentForBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const {
      homestay_id,
      check_in_date,
      check_out_date,
      rooms_booked,
      guests_count,
      contact_phone,
      special_requests,
    } = req.body;

    const homestayId = Number.parseInt(homestay_id, 10);
    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    const checkInParsed = parseDateOnly(check_in_date, "check_in_date");
    const checkOutParsed = parseDateOnly(check_out_date, "check_out_date");
    const roomsParsed = parsePositiveInt(rooms_booked, "rooms_booked");
    const guestsParsed = parsePositiveInt(guests_count, "guests_count");

    const firstError =
      checkInParsed.error ||
      checkOutParsed.error ||
      roomsParsed.error ||
      guestsParsed.error;

    if (firstError) {
      return res.status(400).json({ message: firstError });
    }

    const checkInDate = checkInParsed.value;
    const checkOutDate = checkOutParsed.value;
    const roomsBooked = roomsParsed.value;
    const guestsCount = guestsParsed.value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return res.status(400).json({ message: "check_in_date cannot be in the past" });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: "check_out_date must be after check_in_date" });
    }

    const draft = await getValidatedBookingDraft({
      client,
      homestayId,
      checkInDate,
      checkOutDate,
      roomsBooked,
      guestsCount,
      lockHomestay: false,
    });

    if (draft.error) {
      return res.status(draft.status).json({ message: draft.error });
    }

    const sessionToken = crypto.randomBytes(24).toString("hex");
    const transactionUuid = `OTPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const amount = toMoney(draft.totalPrice);
    const taxAmount = 0;
    const serviceCharge = 0;
    const deliveryCharge = 0;
    const totalAmount = toMoney(amount + taxAmount + serviceCharge + deliveryCharge);

    const totalAmountStr = totalAmount.toFixed(2);
    const signature = createEsewaSignature({
      totalAmount: totalAmountStr,
      transactionUuid,
      productCode: ESEWA_PRODUCT_CODE,
    });

    const serverBaseUrl = getServerBaseUrl(req);
    const successUrl =
      `${serverBaseUrl}/api/bookings/payment/esewa/success` +
      `?session_token=${encodeURIComponent(sessionToken)}` +
      `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;
    const failureUrl =
      `${serverBaseUrl}/api/bookings/payment/esewa/failure` +
      `?session_token=${encodeURIComponent(sessionToken)}` +
      `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;

    await client.query(
      `INSERT INTO booking_payment_sessions
        (session_token, tourist_id, homestay_id, host_id, check_in_date, check_out_date, rooms_booked, guests_count,
         contact_phone, special_requests, nights, rate_per_night, amount, tax_amount, service_charge, delivery_charge,
         total_amount, transaction_uuid, payment_status, payment_response)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, 'initiated', $19::jsonb)`,
      [
        sessionToken,
        touristId,
        homestayId,
        draft.homestay.host_id,
        toDateOnly(checkInDate),
        toDateOnly(checkOutDate),
        roomsBooked,
        guestsCount,
        (contact_phone || "").trim() || null,
        (special_requests || "").trim() || null,
        draft.nights,
        toMoney(draft.homestay.price_per_night),
        amount,
        taxAmount,
        serviceCharge,
        deliveryCharge,
        totalAmount,
        transactionUuid,
        JSON.stringify({ provider: "esewa" }),
      ]
    );

    return res.status(200).json({
      message: "Payment initiated. Redirect to the payment gateway to complete the booking.",
      session_token: sessionToken,
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
          product_delivery_charge: deliveryCharge.toFixed(2),
          success_url: successUrl,
          failure_url: failureUrl,
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature,
        },
      },
      booking_preview: {
        homestay_id: homestayId,
        homestay_name: draft.homestay.name,
        homestay_location: draft.homestay.location,
        nights: draft.nights,
        rooms_booked: roomsBooked,
        guests_count: guestsCount,
        amount,
        total_amount: totalAmount,
      },
    });
  } catch (err) {
    console.error("Error initiating eSewa payment:", err);
    return res.status(500).json({ message: "Server error initiating payment" });
  } finally {
    client.release();
  }
};

export const initiateStripePaymentForBooking = async (req, res) => {
  if (!stripeClient) {
    return res.status(500).json({ message: "Stripe is not configured on server" });
  }

  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const {
      homestay_id,
      check_in_date,
      check_out_date,
      rooms_booked,
      guests_count,
      contact_phone,
      special_requests,
    } = req.body;

    const homestayId = Number.parseInt(homestay_id, 10);
    if (!Number.isInteger(homestayId) || homestayId <= 0) {
      return res.status(400).json({ message: "Invalid homestay id" });
    }

    const checkInParsed = parseDateOnly(check_in_date, "check_in_date");
    const checkOutParsed = parseDateOnly(check_out_date, "check_out_date");
    const roomsParsed = parsePositiveInt(rooms_booked, "rooms_booked");
    const guestsParsed = parsePositiveInt(guests_count, "guests_count");

    const firstError =
      checkInParsed.error ||
      checkOutParsed.error ||
      roomsParsed.error ||
      guestsParsed.error;

    if (firstError) {
      return res.status(400).json({ message: firstError });
    }

    const checkInDate = checkInParsed.value;
    const checkOutDate = checkOutParsed.value;
    const roomsBooked = roomsParsed.value;
    const guestsCount = guestsParsed.value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return res.status(400).json({ message: "check_in_date cannot be in the past" });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: "check_out_date must be after check_in_date" });
    }

    const draft = await getValidatedBookingDraft({
      client,
      homestayId,
      checkInDate,
      checkOutDate,
      roomsBooked,
      guestsCount,
      lockHomestay: false,
    });

    if (draft.error) {
      return res.status(draft.status).json({ message: draft.error });
    }

    const sessionToken = crypto.randomBytes(24).toString("hex");
    const transactionUuid = `STPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const amountNpr = toMoney(draft.totalPrice);
    const taxAmount = 0;
    const serviceCharge = 0;
    const deliveryCharge = 0;
    const totalAmountNpr = toMoney(amountNpr + taxAmount + serviceCharge + deliveryCharge);
    const stripeCurrency = "npr";
    const stripeAmountMinor = convertNprToMinorUnits(totalAmountNpr);

    await client.query(
      `INSERT INTO booking_payment_sessions
        (session_token, tourist_id, homestay_id, host_id, check_in_date, check_out_date, rooms_booked, guests_count,
         contact_phone, special_requests, nights, rate_per_night, amount, tax_amount, service_charge, delivery_charge,
         total_amount, transaction_uuid, payment_status, payment_response)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, 'initiated', $19::jsonb)`,
      [
        sessionToken,
        touristId,
        homestayId,
        draft.homestay.host_id,
        toDateOnly(checkInDate),
        toDateOnly(checkOutDate),
        roomsBooked,
        guestsCount,
        (contact_phone || "").trim() || null,
        (special_requests || "").trim() || null,
        draft.nights,
        toMoney(draft.homestay.price_per_night),
        amountNpr,
        taxAmount,
        serviceCharge,
        deliveryCharge,
        totalAmountNpr,
        transactionUuid,
        JSON.stringify({
          provider: "stripe",
          npr_amount: totalAmountNpr,
          stripe_currency: stripeCurrency,
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
            currency: stripeCurrency,
            unit_amount: stripeAmountMinor,
            product_data: {
              name: `Homestay Booking - ${draft.homestay.name}`,
              description: `${draft.nights} night(s), ${roomsBooked} room(s), ${guestsCount} guest(s)`,
            },
          },
        },
      ],
      success_url:
        `${serverBaseUrl}/api/bookings/payment/stripe/success` +
        `?session_token=${encodeURIComponent(sessionToken)}` +
        `&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${serverBaseUrl}/api/bookings/payment/stripe/cancel` +
        `?session_token=${encodeURIComponent(sessionToken)}`,
      metadata: {
        session_token: sessionToken,
        transaction_uuid: transactionUuid,
        homestay_id: String(homestayId),
        tourist_id: String(touristId),
      },
    });

    await client.query(
      `UPDATE booking_payment_sessions
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
      message: "Stripe checkout initialized.",
      session_token: sessionToken,
      provider: "stripe",
      checkout_url: checkoutSession.url,
      booking_preview: {
        homestay_id: homestayId,
        homestay_name: draft.homestay.name,
        homestay_location: draft.homestay.location,
        nights: draft.nights,
        rooms_booked: roomsBooked,
        guests_count: guestsCount,
        amount_npr: totalAmountNpr,
        stripe_currency: stripeCurrency,
        stripe_amount: Number((stripeAmountMinor / 100).toFixed(2)),
      },
    });
  } catch (err) {
    console.error("Error initiating Stripe payment:", err);
    return res.status(500).json({ message: "Server error initiating Stripe payment" });
  } finally {
    client.release();
  }
};

export const handleEsewaSuccessCallback = async (req, res) => {
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

    const session = await getSessionByTokenOrTransaction({ sessionToken, transactionUuid });
    if (!session) {
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken, reason: "session_not_found" }));
    }

    if (session.payment_status === "success" && session.booking_id) {
      return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token }));
    }

    const statusUrl =
      `${ESEWA_STATUS_CHECK_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}` +
      `&total_amount=${encodeURIComponent(Number(session.total_amount).toFixed(2))}` +
      `&transaction_uuid=${encodeURIComponent(session.transaction_uuid)}`;

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const statusPayload = await statusResponse.json().catch(() => ({}));
    const esewaStatus = parseEsewaStatusPayload(statusPayload);

    if (!statusResponse.ok || !isEsewaSuccessStatus(esewaStatus)) {
      await pool.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'failed',
             payment_response = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify(statusPayload), session.session_id]
      );

      return res.redirect(
        getPaymentFailureRedirectUrl({
          homestayId: session.homestay_id,
          sessionToken: session.session_token,
          reason: esewaStatus || "verification_failed",
        })
      );
    }

    await client.query("BEGIN");

    const lockedSessionResult = await client.query(
      `SELECT * FROM booking_payment_sessions WHERE session_id = $1 FOR UPDATE`,
      [session.session_id]
    );

    if (!lockedSessionResult.rows.length) {
      await client.query("ROLLBACK");
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token, reason: "session_not_found" }));
    }

    const lockedSession = lockedSessionResult.rows[0];
    if (lockedSession.payment_status === "success" && lockedSession.booking_id) {
      await client.query("COMMIT");
      return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token }));
    }

    if (lockedSession.payment_status !== "initiated") {
      await client.query("ROLLBACK");
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token, reason: "invalid_state" }));
    }

    const bookingCreation = await createBookingFromPaymentSession({
      client,
      session: lockedSession,
      touristId: lockedSession.tourist_id,
    });

    if (bookingCreation.error) {
      const fallbackCreation = await createGuaranteedBookingFromPaidSession({
        client,
        session: lockedSession,
        touristId: lockedSession.tourist_id,
      });

      if (fallbackCreation.error) {
        await client.query(
          `UPDATE booking_payment_sessions
           SET payment_status = 'failed',
               payment_response = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE session_id = $2`,
          [JSON.stringify({ ...statusPayload, booking_error: bookingCreation.error, fallback_error: fallbackCreation.error }), lockedSession.session_id]
        );
        await client.query("COMMIT");

        return res.redirect(
          getPaymentFailureRedirectUrl({
            homestayId: lockedSession.homestay_id,
            sessionToken: lockedSession.session_token,
            reason: "booking_create_failed",
          })
        );
      }

      await client.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'success',
             booking_id = $1,
             verified_at = CURRENT_TIMESTAMP,
             payment_ref_id = COALESCE($2, payment_ref_id),
             payment_response = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $4`,
        [
          fallbackCreation.booking.booking_id,
          statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
          JSON.stringify({ ...statusPayload, booking_fallback: true, booking_error: bookingCreation.error }),
          lockedSession.session_id,
        ]
      );

      await upsertPaymentLedgerRecord({
        client,
        session: {
          ...lockedSession,
          payment_status: "success",
          verified_at: new Date(),
          payment_response: { provider: "esewa" },
        },
        bookingId: fallbackCreation.booking.booking_id,
        paymentRefId: statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
      });

      await client.query("COMMIT");
      return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token }));
    }

    await client.query(
      `UPDATE booking_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           verified_at = CURRENT_TIMESTAMP,
           payment_ref_id = COALESCE($2, payment_ref_id),
           payment_response = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $4`,
      [
        bookingCreation.booking.booking_id,
        statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
        JSON.stringify(statusPayload),
        lockedSession.session_id,
      ]
    );

    await upsertPaymentLedgerRecord({
      client,
      session: {
        ...lockedSession,
        payment_status: "success",
        verified_at: new Date(),
        payment_response: { provider: "esewa" },
      },
      bookingId: bookingCreation.booking.booking_id,
      paymentRefId: statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
    });

    await client.query("COMMIT");

    return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token }));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error handling eSewa success callback:", err);
    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken: String(req.query.session_token || ""), reason: "server_error" }));
  } finally {
    client.release();
  }
};

export const handleEsewaFailureCallback = async (req, res) => {
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

    const session = await getSessionByTokenOrTransaction({ sessionToken, transactionUuid });
    if (!session) {
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken, reason: "session_not_found" }));
    }

    if (session.payment_status === "initiated") {
      await pool.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'failed',
             payment_response = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify(callbackData || {}), session.session_id]
      );
    }

    return res.redirect(
      getPaymentFailureRedirectUrl({
        homestayId: session.homestay_id,
        sessionToken: session.session_token,
        reason: "gateway_failed",
      })
    );
  } catch (err) {
    console.error("Error handling eSewa failure callback:", err);
    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken: String(req.query.session_token || ""), reason: "server_error" }));
  }
};

export const handleStripeSuccessCallback = async (req, res) => {
  if (!stripeClient) {
    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken: getCallbackField(req, "session_token"), reason: "stripe_not_configured" }));
  }

  const client = await pool.connect();

  try {
    const sessionToken = getCallbackField(req, "session_token");
    const checkoutSessionId = getCallbackField(req, "checkout_session_id");

    const session = await getSessionByTokenOrTransaction({
      sessionToken,
      transactionUuid: null,
    });

    if (!session) {
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken, reason: "session_not_found" }));
    }

    if (session.payment_status === "success" && session.booking_id) {
      return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token }));
    }

    if (!checkoutSessionId) {
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token, reason: "missing_checkout_session_id" }));
    }

    const stripeSession = await stripeClient.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["payment_intent"],
    });

    const stripePaid = stripeSession.payment_status === "paid" || stripeSession.status === "complete";
    if (!stripePaid) {
      await pool.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [
          JSON.stringify({
            provider: "stripe",
            stripe_checkout_session_id: stripeSession.id,
            stripe_payment_status: stripeSession.payment_status,
            stripe_session_status: stripeSession.status,
          }),
          session.session_id,
        ]
      );

      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token, reason: "stripe_not_paid" }));
    }

    await client.query("BEGIN");

    const lockedSessionResult = await client.query(
      `SELECT * FROM booking_payment_sessions WHERE session_id = $1 FOR UPDATE`,
      [session.session_id]
    );

    if (!lockedSessionResult.rows.length) {
      await client.query("ROLLBACK");
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token, reason: "session_not_found" }));
    }

    const lockedSession = lockedSessionResult.rows[0];
    if (lockedSession.payment_status === "success" && lockedSession.booking_id) {
      await client.query("COMMIT");
      return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token }));
    }

    if (lockedSession.payment_status !== "initiated") {
      await client.query("ROLLBACK");
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token, reason: "invalid_state" }));
    }

    const bookingCreation = await createBookingFromPaymentSession({
      client,
      session: lockedSession,
      touristId: lockedSession.tourist_id,
    });

    let finalBooking = bookingCreation.booking;
    if (bookingCreation.error) {
      const fallbackCreation = await createGuaranteedBookingFromPaidSession({
        client,
        session: lockedSession,
        touristId: lockedSession.tourist_id,
      });

      if (fallbackCreation.error) {
        await client.query(
          `UPDATE booking_payment_sessions
           SET payment_status = 'failed',
               payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE session_id = $2`,
          [
            JSON.stringify({
              provider: "stripe",
              booking_error: bookingCreation.error,
              fallback_error: fallbackCreation.error,
              stripe_checkout_session_id: stripeSession.id,
            }),
            lockedSession.session_id,
          ]
        );

        await client.query("COMMIT");
        return res.redirect(getPaymentFailureRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token, reason: "booking_create_failed" }));
      }

      finalBooking = fallbackCreation.booking;
    }

    await client.query(
      `UPDATE booking_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           verified_at = CURRENT_TIMESTAMP,
           payment_ref_id = $2,
           payment_response = COALESCE(payment_response, '{}'::jsonb) || $3::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = $4`,
      [
        finalBooking.booking_id,
        stripeSession.payment_intent?.id || stripeSession.id,
        JSON.stringify({
          provider: "stripe",
          stripe_checkout_session_id: stripeSession.id,
          stripe_payment_status: stripeSession.payment_status,
          stripe_session_status: stripeSession.status,
        }),
        lockedSession.session_id,
      ]
    );

    await upsertPaymentLedgerRecord({
      client,
      session: {
        ...lockedSession,
        payment_status: "success",
        verified_at: new Date(),
        payment_response: { provider: "stripe" },
      },
      bookingId: finalBooking.booking_id,
      paymentRefId: stripeSession.payment_intent?.id || stripeSession.id,
    });

    await client.query("COMMIT");
    return res.redirect(getPaymentSuccessRedirectUrl({ homestayId: lockedSession.homestay_id, sessionToken: lockedSession.session_token }));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error handling Stripe success callback:", err);
    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken: getCallbackField(req, "session_token"), reason: "server_error" }));
  } finally {
    client.release();
  }
};

export const handleStripeCancelCallback = async (req, res) => {
  try {
    const sessionToken = getCallbackField(req, "session_token");
    const session = await getSessionByTokenOrTransaction({ sessionToken, transactionUuid: null });

    if (!session) {
      return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken, reason: "session_not_found" }));
    }

    if (session.payment_status === "initiated") {
      await pool.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'failed',
             payment_response = COALESCE(payment_response, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [JSON.stringify({ provider: "stripe", reason: "cancelled_by_user" }), session.session_id]
      );
    }

    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: session.homestay_id, sessionToken: session.session_token, reason: "cancelled" }));
  } catch (err) {
    console.error("Error handling Stripe cancel callback:", err);
    return res.redirect(getPaymentFailureRedirectUrl({ homestayId: "", sessionToken: getCallbackField(req, "session_token"), reason: "server_error" }));
  }
};

export const verifyEsewaPaymentAndCreateBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const sessionToken = String(req.body.session_token || "").trim();
    if (!sessionToken) {
      return res.status(400).json({ message: "session_token is required" });
    }

    const sessionResult = await pool.query(
      `SELECT * FROM booking_payment_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({ message: "Payment session not found" });
    }

    const session = sessionResult.rows[0];

    if (session.tourist_id !== touristId) {
      return res.status(403).json({ message: "You can only verify your own payment sessions" });
    }

    if (session.payment_status === "success" && session.booking_id) {
      const bookingResult = await pool.query(
        `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location
         FROM homestay_bookings b
         JOIN homestays h ON b.homestay_id = h.homestay_id
         WHERE b.booking_id = $1`,
        [session.booking_id]
      );

      return res.status(200).json({
        message: "Payment already verified. Booking already confirmed.",
        booking: bookingResult.rows[0] || null,
      });
    }

    if (session.payment_status === "failed" || session.payment_status === "expired") {
      return res.status(400).json({ message: "This payment session is no longer valid" });
    }

    const statusUrl =
      `${ESEWA_STATUS_CHECK_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}` +
      `&total_amount=${encodeURIComponent(Number(session.total_amount).toFixed(2))}` +
      `&transaction_uuid=${encodeURIComponent(session.transaction_uuid)}`;

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const statusPayload = await statusResponse.json().catch(() => ({}));
    const gatewayStatus = parseEsewaStatusPayload(statusPayload);

    if (!statusResponse.ok || !isEsewaSuccessStatus(gatewayStatus)) {
      await pool.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'failed',
             payment_response = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_token = $2`,
        [JSON.stringify({ provider: "esewa", ...statusPayload }), sessionToken]
      );

      return res.status(400).json({
        message: "Payment verification failed. Please complete payment and try again.",
        payment_provider: "esewa",
        gateway_status: gatewayStatus || null,
        esewa_status: gatewayStatus || null,
      });
    }

    await client.query("BEGIN");

    const lockedSessionResult = await client.query(
      `SELECT * FROM booking_payment_sessions WHERE session_token = $1 FOR UPDATE`,
      [sessionToken]
    );

    if (!lockedSessionResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Payment session not found" });
    }

    const lockedSession = lockedSessionResult.rows[0];
    if (lockedSession.payment_status === "success" && lockedSession.booking_id) {
      const bookingResult = await client.query(
        `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location
         FROM homestay_bookings b
         JOIN homestays h ON b.homestay_id = h.homestay_id
         WHERE b.booking_id = $1`,
        [lockedSession.booking_id]
      );

      await client.query("COMMIT");
      return res.status(200).json({
        message: "Payment already verified. Booking already confirmed.",
        booking: bookingResult.rows[0] || null,
      });
    }

    if (lockedSession.payment_status !== "initiated") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Payment session is not in a verifiable state" });
    }

    const bookingCreation = await createBookingFromPaymentSession({
      client,
      session: lockedSession,
      touristId,
    });

    if (bookingCreation.error) {
      const fallbackCreation = await createGuaranteedBookingFromPaidSession({
        client,
        session: lockedSession,
        touristId,
      });

      if (fallbackCreation.error) {
        await client.query(
          `UPDATE booking_payment_sessions
           SET payment_status = 'failed',
               payment_response = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE session_token = $2`,
          [JSON.stringify({ ...statusPayload, booking_error: bookingCreation.error, fallback_error: fallbackCreation.error }), sessionToken]
        );

        await client.query("COMMIT");
        return res.status(fallbackCreation.status).json({ message: fallbackCreation.error });
      }

      await client.query(
        `UPDATE booking_payment_sessions
         SET payment_status = 'success',
             booking_id = $1,
             verified_at = CURRENT_TIMESTAMP,
             payment_ref_id = COALESCE($2, payment_ref_id),
             payment_response = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE session_token = $4`,
        [
          fallbackCreation.booking.booking_id,
          statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
          JSON.stringify({ ...statusPayload, booking_fallback: true, booking_error: bookingCreation.error }),
          sessionToken,
        ]
      );

      await upsertPaymentLedgerRecord({
        client,
        session: {
          ...lockedSession,
          payment_status: "success",
          verified_at: new Date(),
          payment_response: { provider: "esewa" },
        },
        bookingId: fallbackCreation.booking.booking_id,
        paymentRefId: statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
      });

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Payment successful and booking confirmed.",
        booking: fallbackCreation.booking,
        payment: {
          session_token: sessionToken,
          transaction_uuid: lockedSession.transaction_uuid,
          payment_provider: "esewa",
          gateway_status: gatewayStatus,
          esewa_status: gatewayStatus,
        },
      });
    }

    await client.query(
      `UPDATE booking_payment_sessions
       SET payment_status = 'success',
           booking_id = $1,
           verified_at = CURRENT_TIMESTAMP,
           payment_ref_id = COALESCE($2, payment_ref_id),
           payment_response = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_token = $4`,
      [
        bookingCreation.booking.booking_id,
        statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
        JSON.stringify(statusPayload),
        sessionToken,
      ]
    );

    await upsertPaymentLedgerRecord({
      client,
      session: {
        ...lockedSession,
        payment_status: "success",
        verified_at: new Date(),
        payment_response: { provider: "esewa" },
      },
      bookingId: bookingCreation.booking.booking_id,
      paymentRefId: statusPayload.ref_id || statusPayload.reference_id || statusPayload.transaction_code || null,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Payment successful and booking confirmed.",
      booking: bookingCreation.booking,
      payment: {
        session_token: sessionToken,
        transaction_uuid: lockedSession.transaction_uuid,
        payment_provider: "esewa",
        gateway_status: gatewayStatus,
        esewa_status: gatewayStatus,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error verifying eSewa payment:", err);
    return res.status(500).json({ message: "Server error verifying payment" });
  } finally {
    client.release();
  }
};

export const getPaymentSessionStatus = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const sessionToken = String(req.params.sessionToken || "").trim();

    if (!sessionToken) {
      return res.status(400).json({ message: "session token is required" });
    }

    const result = await pool.query(
      `SELECT ps.session_token, ps.payment_status, ps.transaction_uuid, ps.amount, ps.total_amount,
              COALESCE(ps.payment_response->>'provider', CASE WHEN ps.transaction_uuid LIKE 'STPAY-%' THEN 'stripe' ELSE 'esewa' END) AS payment_provider,
              ps.created_at, ps.verified_at, ps.booking_id,
              b.booking_code, b.status AS booking_status
       FROM booking_payment_sessions ps
       LEFT JOIN homestay_bookings b ON ps.booking_id = b.booking_id
       WHERE ps.session_token = $1 AND ps.tourist_id = $2`,
      [sessionToken, touristId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Payment session not found" });
    }

    return res.status(200).json({ payment: result.rows[0] });
  } catch (err) {
    console.error("Error fetching payment session:", err);
    return res.status(500).json({ message: "Server error fetching payment session" });
  }
};

export const getAdminBookingPayments = async (req, res) => {
  try {
    const result = await pool.query(
          `SELECT ps.session_id, ps.session_token, ps.payment_status, ps.transaction_uuid, ps.payment_ref_id,
            COALESCE(ps.payment_response->>'provider', CASE WHEN ps.transaction_uuid LIKE 'STPAY-%' THEN 'stripe' ELSE 'esewa' END) AS payment_provider,
              ps.amount, ps.total_amount, ps.created_at AS payment_initiated_at, ps.verified_at,
              b.booking_id, b.booking_code, b.status AS booking_status,
              h.homestay_id, h.name AS homestay_name,
              t.tourist_id, t.full_name AS tourist_name, t.email AS tourist_email,
              hs.host_id, hs.full_name AS host_name, hs.email AS host_email
       FROM booking_payment_sessions ps
       LEFT JOIN homestay_bookings b ON ps.booking_id = b.booking_id
       JOIN homestays h ON ps.homestay_id = h.homestay_id
       JOIN tourists t ON ps.tourist_id = t.tourist_id
       JOIN hosts hs ON ps.host_id = hs.host_id
       ORDER BY ps.created_at DESC
       LIMIT 500`
    );

    return res.status(200).json({ records: result.rows });
  } catch (err) {
    console.error("Error fetching admin booking payments:", err);
    return res.status(500).json({ message: "Server error fetching payment records" });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const touristId = req.user.user_id;

    const result = await pool.query(
      `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location, h.contact_phone AS homestay_contact_phone,
              t.trail_id, t.trail_name,
              ps.payment_status, ps.payment_ref_id, ps.transaction_uuid
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       JOIN trekking_trails t ON h.trail_id = t.trail_id
       LEFT JOIN booking_payment_sessions ps ON ps.booking_id = b.booking_id
       WHERE b.tourist_id = $1
       ORDER BY b.created_at DESC`,
      [touristId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error("Error fetching tourist bookings:", err);
    res.status(500).json({ message: "Server error fetching bookings" });
  }
};

export const getHostBookings = async (req, res) => {
  try {
    const hostId = req.user.user_id;

    const result = await pool.query(
      `SELECT b.*, h.name AS homestay_name, h.location AS homestay_location,
              tr.trail_name,
              ts.full_name AS tourist_name, ts.email AS tourist_email, ts.phone AS tourist_phone,
              ps.payment_status, ps.payment_ref_id, ps.transaction_uuid
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       JOIN trekking_trails tr ON h.trail_id = tr.trail_id
       JOIN tourists ts ON b.tourist_id = ts.tourist_id
       LEFT JOIN booking_payment_sessions ps ON ps.booking_id = b.booking_id
       WHERE b.host_id = $1
       ORDER BY b.created_at DESC`,
      [hostId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error("Error fetching host bookings:", err);
    res.status(500).json({ message: "Server error fetching bookings" });
  }
};

export const cancelTouristBooking = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.booking_id, b.status, b.rooms_booked, b.homestay_id, b.tourist_id,
              h.total_rooms, h.available_rooms
       FROM homestay_bookings b
       JOIN homestays h ON b.homestay_id = h.homestay_id
       WHERE b.booking_id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (!bookingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    if (booking.tourist_id !== touristId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can only cancel your own bookings" });
    }

    if (booking.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    await client.query(
      `UPDATE homestay_bookings
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    await client.query(
      `UPDATE homestays
       SET available_rooms = LEAST(total_rooms, available_rooms + $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE homestay_id = $2`,
      [booking.rooms_booked, booking.homestay_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error cancelling booking:", err);
    return res.status(500).json({ message: "Server error cancelling booking" });
  } finally {
    client.release();
  }
};
