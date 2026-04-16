ALTER TABLE tourist_platform_reviews
  ADD COLUMN IF NOT EXISTS submitter_user_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS submitter_user_id INTEGER;

UPDATE tourist_platform_reviews
SET
  submitter_user_type = COALESCE(submitter_user_type, 'tourist'),
  submitter_user_id = COALESCE(submitter_user_id, tourist_id)
WHERE submitter_user_type IS NULL
   OR submitter_user_id IS NULL;

ALTER TABLE tourist_platform_reviews
  ALTER COLUMN submitter_user_type SET NOT NULL,
  ALTER COLUMN submitter_user_id SET NOT NULL;

ALTER TABLE tourist_platform_reviews
  ALTER COLUMN tourist_id DROP NOT NULL;

ALTER TABLE tourist_platform_reviews
  DROP CONSTRAINT IF EXISTS chk_tourist_platform_reviews_submitter_user_type;

ALTER TABLE tourist_platform_reviews
  ADD CONSTRAINT chk_tourist_platform_reviews_submitter_user_type
  CHECK (submitter_user_type IN ('tourist', 'host', 'guide'));

CREATE INDEX IF NOT EXISTS idx_tourist_platform_reviews_submitter_created
  ON tourist_platform_reviews(submitter_user_type, submitter_user_id, created_at DESC);
