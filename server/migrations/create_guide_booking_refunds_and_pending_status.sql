BEGIN;

ALTER TABLE guide_package_bookings
  ALTER COLUMN status SET DEFAULT 'pending';

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'guide_package_bookings'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE guide_package_bookings DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE guide_package_bookings
  ADD CONSTRAINT guide_package_bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refund_requested', 'refunded'));

CREATE TABLE IF NOT EXISTS guide_booking_refunds (
  refund_id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES guide_package_bookings(booking_id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES guide_package_payment_sessions(session_id) ON DELETE SET NULL,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount >= 0),
  approved_amount NUMERIC(12,2) CHECK (approved_amount >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'NPR',
  refund_reason TEXT,
  policy_rule VARCHAR(64),
  refund_status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (refund_status IN ('requested', 'processed', 'rejected')),
  provider VARCHAR(20),
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  processed_at TIMESTAMP,
  reviewed_by_user_id INTEGER,
  review_note TEXT,
  gateway_refund_reference VARCHAR(128),
  gateway_response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_booking_refunds_status
  ON guide_booking_refunds(refund_status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_booking_refunds_tourist
  ON guide_booking_refunds(tourist_id, requested_at DESC);

COMMIT;
