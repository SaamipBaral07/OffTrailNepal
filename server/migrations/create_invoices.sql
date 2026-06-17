-- Generate and store downloadable invoices for paid homestay and guide-package bookings.

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(48) NOT NULL UNIQUE,
  booking_type VARCHAR(20) NOT NULL CHECK (booking_type IN ('homestay', 'guide_package')),
  booking_id INTEGER NOT NULL,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  currency VARCHAR(8) NOT NULL DEFAULT 'NPR',
  subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_status VARCHAR(30) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(128),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ux_invoices_booking UNIQUE (booking_type, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tourist_issued
  ON invoices(tourist_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_booking_lookup
  ON invoices(booking_type, booking_id);
