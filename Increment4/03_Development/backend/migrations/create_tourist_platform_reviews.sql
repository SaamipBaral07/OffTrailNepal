CREATE TABLE IF NOT EXISTS tourist_platform_reviews (
  review_id SERIAL PRIMARY KEY,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  reviewer_location VARCHAR(120),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_by_admin_id INTEGER REFERENCES admins(admin_id) ON DELETE SET NULL,
  featured_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tourist_platform_reviews_featured
  ON tourist_platform_reviews(is_featured, featured_at DESC);

CREATE INDEX IF NOT EXISTS idx_tourist_platform_reviews_updated
  ON tourist_platform_reviews(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tourist_platform_reviews_tourist_created
  ON tourist_platform_reviews(tourist_id, created_at DESC);
