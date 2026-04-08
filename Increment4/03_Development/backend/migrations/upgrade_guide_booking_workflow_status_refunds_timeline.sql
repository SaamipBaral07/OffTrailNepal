BEGIN;

ALTER TABLE guide_package_bookings
  ADD COLUMN IF NOT EXISTS approval_deadline_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP;

UPDATE guide_package_bookings
SET approval_deadline_at = COALESCE(approval_deadline_at, created_at + INTERVAL '24 hours')
WHERE approval_deadline_at IS NULL;

ALTER TABLE guide_package_bookings
  ALTER COLUMN approval_deadline_at SET NOT NULL;

ALTER TABLE guide_package_bookings
  ALTER COLUMN approval_deadline_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

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
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'refund_requested', 'refunded', 'expired'));

UPDATE guide_booking_refunds
SET refund_status = 'refunded'
WHERE refund_status = 'processed';

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'guide_booking_refunds'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%refund_status%'
  LOOP
    EXECUTE format('ALTER TABLE guide_booking_refunds DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE guide_booking_refunds
  ADD CONSTRAINT guide_booking_refunds_refund_status_check
  CHECK (refund_status IN ('requested', 'processing', 'refunded', 'rejected'));

CREATE TABLE IF NOT EXISTS guide_booking_timeline (
  event_id BIGSERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES guide_package_bookings(booking_id) ON DELETE CASCADE,
  actor_role VARCHAR(24) NOT NULL,
  actor_user_id INTEGER,
  action VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  note TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_booking_timeline_booking
  ON guide_booking_timeline(booking_id, created_at DESC);

COMMIT;
