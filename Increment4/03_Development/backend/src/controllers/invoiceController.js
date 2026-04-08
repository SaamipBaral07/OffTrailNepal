import pool from "../config/db.js";

const PAID_STATUSES = new Set(["success", "refund_requested", "refunded"]);

const COMPANY_INFO = {
  name: "OffTrail Nepal",
  location: "Pokhara, Nepal",
  logo_path: "/offtrail-latest.png",
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBookingType = (bookingTypeParam) => {
  const value = String(bookingTypeParam || "").trim().toLowerCase();
  if (value === "homestay") return "homestay";
  if (value === "guide" || value === "guide_package" || value === "guide-package") {
    return "guide_package";
  }
  return "";
};

const normalizePaymentStatus = (value) => String(value || "").trim().toLowerCase();

const isInvoiceEligiblePayment = (paymentStatus) => PAID_STATUSES.has(normalizePaymentStatus(paymentStatus));

const buildInvoiceNumber = (bookingType, bookingCode) => {
  const normalizedCode = String(bookingCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (normalizedCode) {
    return `OTN-INV-${normalizedCode}`;
  }

  const typeCode = bookingType === "guide_package" ? "G" : "H";
  return `OTN-INV-${typeCode}-${Date.now()}`;
};

const getHomestayInvoiceSource = async (client, touristId, bookingId) => {
  const result = await client.query(
    `SELECT b.booking_id, b.booking_code, b.status AS booking_status,
            b.check_in_date AS stay_start_date, b.check_out_date AS stay_end_date,
            b.rooms_booked, b.guests_count, b.total_price,
            h.name AS listing_name, h.location AS listing_location,
            t.full_name AS tourist_name, t.email AS tourist_email, t.phone AS tourist_phone,
            COALESCE(p.payment_status, ps.payment_status) AS payment_status,
            COALESCE(
              p.payment_method,
              CASE
                WHEN ps.transaction_uuid LIKE 'STPAY-%' THEN 'stripe'
                WHEN ps.transaction_uuid IS NOT NULL THEN 'esewa'
                ELSE NULL
              END
            ) AS payment_method,
            COALESCE(p.transaction_reference, ps.payment_ref_id, ps.transaction_uuid) AS payment_reference,
            COALESCE(ps.amount, b.total_price) AS subtotal_amount,
            COALESCE(ps.tax_amount, 0) AS tax_amount,
            COALESCE(ps.service_charge, 0) AS service_charge,
            COALESCE(ps.total_amount, p.amount, b.total_price) AS total_amount,
            COALESCE(p.paid_at, ps.verified_at, ps.created_at, b.created_at) AS paid_at
     FROM homestay_bookings b
     JOIN homestays h ON h.homestay_id = b.homestay_id
     JOIN tourists t ON t.tourist_id = b.tourist_id
     LEFT JOIN LATERAL (
       SELECT amount, tax_amount, service_charge, total_amount,
              payment_status, payment_ref_id, transaction_uuid,
              verified_at, created_at
       FROM booking_payment_sessions
       WHERE booking_id = b.booking_id
       ORDER BY session_id DESC
       LIMIT 1
     ) ps ON TRUE
     LEFT JOIN payments p ON p.booking_id = b.booking_id
     WHERE b.booking_id = $1
       AND b.tourist_id = $2
     LIMIT 1`,
    [bookingId, touristId]
  );

  return result.rows[0] || null;
};

const getGuideInvoiceSource = async (client, touristId, bookingId) => {
  const result = await client.query(
    `SELECT b.booking_id, b.booking_code, b.status AS booking_status,
            b.start_date AS stay_start_date, b.end_date AS stay_end_date,
            b.participants_count, b.total_price,
            gs.title AS listing_name,
            t.trail_name AS listing_location,
            g.full_name AS guide_name,
            tr.full_name AS tourist_name, tr.email AS tourist_email, tr.phone AS tourist_phone,
            ps.payment_status,
            CASE
              WHEN ps.transaction_uuid LIKE 'GSPAY-%' THEN 'stripe'
              WHEN ps.transaction_uuid IS NOT NULL THEN 'esewa'
              ELSE NULL
            END AS payment_method,
            COALESCE(ps.payment_ref_id, ps.transaction_uuid) AS payment_reference,
            COALESCE(ps.amount, b.total_price) AS subtotal_amount,
            COALESCE(ps.tax_amount, 0) AS tax_amount,
            COALESCE(ps.service_charge, 0) AS service_charge,
            COALESCE(ps.total_amount, b.total_price) AS total_amount,
            COALESCE(ps.verified_at, ps.created_at, b.created_at) AS paid_at
     FROM guide_package_bookings b
     JOIN guide_services gs ON gs.service_id = b.service_id
     JOIN guides g ON g.guide_id = b.guide_id
     JOIN trekking_trails t ON t.trail_id = b.trail_id
     JOIN tourists tr ON tr.tourist_id = b.tourist_id
     LEFT JOIN LATERAL (
       SELECT amount, tax_amount, service_charge, total_amount,
              payment_status, payment_ref_id, transaction_uuid,
              verified_at, created_at
       FROM guide_package_payment_sessions
       WHERE booking_id = b.booking_id
       ORDER BY session_id DESC
       LIMIT 1
     ) ps ON TRUE
     WHERE b.booking_id = $1
       AND b.tourist_id = $2
     LIMIT 1`,
    [bookingId, touristId]
  );

  return result.rows[0] || null;
};

const buildSnapshot = (bookingType, source) => {
  const startDate = source?.stay_start_date || null;
  const endDate = source?.stay_end_date || null;

  return {
    booking_code: source.booking_code,
    booking_status: source.booking_status,
    listing_name: source.listing_name,
    listing_location: source.listing_location,
    guide_name: source.guide_name || null,
    billing_name: source.tourist_name,
    billing_email: source.tourist_email || null,
    billing_phone: source.tourist_phone || null,
    stay_start_date: startDate,
    stay_end_date: endDate,
    nights:
      bookingType === "homestay" && startDate && endDate
        ? Math.max(
            1,
            Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
          )
        : null,
    rooms_booked: bookingType === "homestay" ? Number(source.rooms_booked || 0) : null,
    guests_count: bookingType === "homestay" ? Number(source.guests_count || 0) : null,
    participants_count: bookingType === "guide_package" ? Number(source.participants_count || 0) : null,
  };
};

const upsertInvoice = async (client, invoiceInput) => {
  const result = await client.query(
    `INSERT INTO invoices (
      invoice_number, booking_type, booking_id, tourist_id,
      currency, subtotal_amount, tax_amount, service_charge, total_amount,
      payment_status, payment_method, payment_reference, snapshot
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12, $13
    )
    ON CONFLICT (booking_type, booking_id)
    DO UPDATE SET
      tourist_id = EXCLUDED.tourist_id,
      currency = EXCLUDED.currency,
      subtotal_amount = EXCLUDED.subtotal_amount,
      tax_amount = EXCLUDED.tax_amount,
      service_charge = EXCLUDED.service_charge,
      total_amount = EXCLUDED.total_amount,
      payment_status = EXCLUDED.payment_status,
      payment_method = COALESCE(EXCLUDED.payment_method, invoices.payment_method),
      payment_reference = COALESCE(EXCLUDED.payment_reference, invoices.payment_reference),
      snapshot = EXCLUDED.snapshot,
      updated_at = CURRENT_TIMESTAMP
    RETURNING invoice_id, invoice_number, booking_type, booking_id,
              issued_at, currency, subtotal_amount, tax_amount,
              service_charge, total_amount, payment_status,
              payment_method, payment_reference, snapshot`,
    [
      invoiceInput.invoiceNumber,
      invoiceInput.bookingType,
      invoiceInput.bookingId,
      invoiceInput.touristId,
      "NPR",
      invoiceInput.subtotalAmount,
      invoiceInput.taxAmount,
      invoiceInput.serviceCharge,
      invoiceInput.totalAmount,
      invoiceInput.paymentStatus,
      invoiceInput.paymentMethod,
      invoiceInput.paymentReference,
      JSON.stringify(invoiceInput.snapshot),
    ]
  );

  return result.rows[0];
};

export const getTouristInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    const touristId = req.user.user_id;
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    const bookingType = normalizeBookingType(req.params.bookingType);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!bookingType) {
      return res.status(400).json({ message: "bookingType must be homestay or guide_package" });
    }

    await client.query("BEGIN");

    const source =
      bookingType === "homestay"
        ? await getHomestayInvoiceSource(client, touristId, bookingId)
        : await getGuideInvoiceSource(client, touristId, bookingId);

    if (!source) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!isInvoiceEligiblePayment(source.payment_status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Invoice is available only after successful payment",
      });
    }

    const snapshot = buildSnapshot(bookingType, source);
    const invoiceRow = await upsertInvoice(client, {
      invoiceNumber: buildInvoiceNumber(bookingType, source.booking_code),
      bookingType,
      bookingId,
      touristId,
      subtotalAmount: toNumber(source.subtotal_amount),
      taxAmount: toNumber(source.tax_amount),
      serviceCharge: toNumber(source.service_charge),
      totalAmount: toNumber(source.total_amount),
      paymentStatus: normalizePaymentStatus(source.payment_status),
      paymentMethod: source.payment_method || null,
      paymentReference: source.payment_reference || null,
      snapshot,
    });

    await client.query("COMMIT");

    const responseSnapshot = typeof invoiceRow.snapshot === "string"
      ? JSON.parse(invoiceRow.snapshot)
      : invoiceRow.snapshot;

    return res.status(200).json({
      invoice: {
        invoice_id: invoiceRow.invoice_id,
        invoice_number: invoiceRow.invoice_number,
        booking_type: invoiceRow.booking_type,
        booking_id: invoiceRow.booking_id,
        issued_at: invoiceRow.issued_at,
        currency: invoiceRow.currency,
        subtotal_amount: toNumber(invoiceRow.subtotal_amount),
        tax_amount: toNumber(invoiceRow.tax_amount),
        service_charge: toNumber(invoiceRow.service_charge),
        total_amount: toNumber(invoiceRow.total_amount),
        payment_status: invoiceRow.payment_status,
        payment_method: invoiceRow.payment_method,
        payment_reference: invoiceRow.payment_reference,
        snapshot: responseSnapshot,
        issuer: COMPANY_INFO,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error generating invoice:", err);
    return res.status(500).json({ message: "Server error generating invoice" });
  } finally {
    client.release();
  }
};
