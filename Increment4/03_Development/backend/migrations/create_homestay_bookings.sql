-- Create homestay bookings table for tourist reservations
-- Run against offtrail_nepal database

CREATE TABLE IF NOT EXISTS homestay_bookings (
  booking_id SERIAL PRIMARY KEY,
  booking_code VARCHAR(24) NOT NULL UNIQUE,
  homestay_id INTEGER NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES hosts(host_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  rooms_booked INTEGER NOT NULL CHECK (rooms_booked > 0),
  guests_count INTEGER NOT NULL CHECK (guests_count > 0),
  contact_phone VARCHAR(32),
  special_requests TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  CONSTRAINT chk_booking_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_homestay_bookings_tourist
  ON homestay_bookings(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homestay_bookings_host
  ON homestay_bookings(host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homestay_bookings_homestay
  ON homestay_bookings(homestay_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homestay_bookings_status
  ON homestay_bookings(status);
