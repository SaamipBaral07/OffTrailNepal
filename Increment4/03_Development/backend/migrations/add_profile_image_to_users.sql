ALTER TABLE tourists
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;

ALTER TABLE hosts
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;
