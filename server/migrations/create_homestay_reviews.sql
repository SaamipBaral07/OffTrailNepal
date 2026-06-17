-- Create homestay reviews submitted by tourists after checkout.
-- One review per booking ensures ratings map to a real stay.

CREATE TABLE IF NOT EXISTS homestay_reviews (
  review_id SERIAL PRIMARY KEY,
  homestay_id INTEGER NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES hosts(host_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES homestay_bookings(booking_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homestay_reviews_homestay_created
  ON homestay_reviews(homestay_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homestay_reviews_host_created
  ON homestay_reviews(host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homestay_reviews_tourist_created
  ON homestay_reviews(tourist_id, created_at DESC);
