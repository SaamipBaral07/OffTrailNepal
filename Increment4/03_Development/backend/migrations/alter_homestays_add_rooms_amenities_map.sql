-- ================================================
-- HOMESTAY ENHANCEMENTS
-- - amenities
-- - total_rooms / available_rooms
-- - google_map_iframe_link
-- ================================================

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}'::text[];

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS total_rooms INT NOT NULL DEFAULT 1;

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS available_rooms INT NOT NULL DEFAULT 1;

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS google_map_iframe_link TEXT;

UPDATE homestays
SET total_rooms = GREATEST(COALESCE(total_rooms, 1), 1),
    available_rooms = LEAST(GREATEST(COALESCE(available_rooms, COALESCE(total_rooms, 1)), 0), GREATEST(COALESCE(total_rooms, 1), 1));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'homestays_available_rooms_check'
  ) THEN
    ALTER TABLE homestays
      ADD CONSTRAINT homestays_available_rooms_check
      CHECK (available_rooms >= 0 AND total_rooms >= 1 AND available_rooms <= total_rooms);
  END IF;
END $$;
