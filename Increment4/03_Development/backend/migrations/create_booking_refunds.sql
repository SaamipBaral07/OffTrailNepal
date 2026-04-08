-- Create refund workflow model for paid homestay bookings.
-- This keeps direct cancellation for unpaid bookings but enforces refund flow for paid ones.

CREATE TABLE IF NOT EXISTS booking_refunds (
  refund_id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES homestay_bookings(booking_id) ON DELETE CASCADE,
  payment_id INTEGER REFERENCES payments(payment_id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES booking_payment_sessions(session_id) ON DELETE SET NULL,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount >= 0),
  approved_amount NUMERIC(12,2) NOT NULL CHECK (approved_amount >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'NPR',
  refund_reason TEXT,
  policy_rule VARCHAR(64),
  refund_status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (refund_status IN ('requested', 'approved', 'processed', 'rejected', 'failed')),
  provider VARCHAR(20),
  gateway_refund_reference VARCHAR(128),
  gateway_response JSONB,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  processed_at TIMESTAMP,
  reviewed_by_user_id INTEGER,
  review_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_refunds_status_requested_at
  ON booking_refunds(refund_status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_refunds_tourist
  ON booking_refunds(tourist_id, requested_at DESC);

-- Extend homestay booking lifecycle with refund states.
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'homestay_bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%confirmed%'
  LOOP
    EXECUTE format('ALTER TABLE homestay_bookings DROP CONSTRAINT %I', c_name);
  END LOOP;

  ALTER TABLE homestay_bookings
    ADD CONSTRAINT homestay_bookings_status_check
    CHECK (status IN ('confirmed', 'cancelled', 'refund_requested', 'refunded'));
END $$;

-- Extend payment session status values so refund lifecycle can be reflected in the table.
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'booking_payment_sessions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE booking_payment_sessions DROP CONSTRAINT %I', c_name);
  END LOOP;

  ALTER TABLE booking_payment_sessions
    ADD CONSTRAINT booking_payment_sessions_payment_status_check
    CHECK (payment_status IN ('initiated', 'success', 'failed', 'expired', 'refund_requested', 'refunded'));
END $$;
