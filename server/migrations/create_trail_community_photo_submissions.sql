BEGIN;

CREATE TABLE IF NOT EXISTS trail_photo_submissions (
  submission_id SERIAL PRIMARY KEY,
  trail_id INTEGER NOT NULL REFERENCES trekking_trails(trail_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  caption TEXT,
  trek_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reviewed_by INTEGER REFERENCES admins(admin_id) ON DELETE SET NULL,
  admin_reviewed_at TIMESTAMP,
  admin_review_note TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trail_photo_submission_images (
  image_id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES trail_photo_submissions(submission_id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trail_photo_submissions_trail_status_created
  ON trail_photo_submissions(trail_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trail_photo_submissions_tourist_created
  ON trail_photo_submissions(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trail_photo_submission_images_submission_order
  ON trail_photo_submission_images(submission_id, display_order ASC);

COMMIT;
