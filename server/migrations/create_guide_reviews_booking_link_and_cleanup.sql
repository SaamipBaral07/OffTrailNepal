BEGIN;

-- Remove legacy seed/testing rows so production reviews can start fresh.
DELETE FROM guide_reviews;

ALTER TABLE guide_reviews
  ADD COLUMN IF NOT EXISTS booking_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'guide_reviews'::regclass
      AND conname = 'guide_reviews_booking_id_fkey'
  ) THEN
    ALTER TABLE guide_reviews
      ADD CONSTRAINT guide_reviews_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES guide_package_bookings(booking_id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE guide_reviews
  ALTER COLUMN booking_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_guide_reviews_booking_id
  ON guide_reviews(booking_id);

CREATE INDEX IF NOT EXISTS idx_guide_reviews_guide_created_at
  ON guide_reviews(guide_id, created_at DESC);

COMMIT;
