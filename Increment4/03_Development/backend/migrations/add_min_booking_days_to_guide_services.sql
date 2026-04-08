-- Add per-service minimum booking duration for guide packages.
ALTER TABLE guide_services
  ADD COLUMN IF NOT EXISTS min_booking_days INT;

UPDATE guide_services
SET min_booking_days = 1
WHERE min_booking_days IS NULL OR min_booking_days <= 0;

ALTER TABLE guide_services
  ALTER COLUMN min_booking_days SET DEFAULT 1;

ALTER TABLE guide_services
  ALTER COLUMN min_booking_days SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guide_services_min_booking_days_check'
      AND conrelid = 'guide_services'::regclass
  ) THEN
    ALTER TABLE guide_services
      ADD CONSTRAINT guide_services_min_booking_days_check
      CHECK (min_booking_days > 0);
  END IF;
END $$;
