-- Create booking payment sessions for homestay booking payments
-- Run against offtrail_nepal database

CREATE TABLE IF NOT EXISTS booking_payment_sessions (
  session_id SERIAL PRIMARY KEY,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  homestay_id INTEGER NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES hosts(host_id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  rooms_booked INTEGER NOT NULL CHECK (rooms_booked > 0),
  guests_count INTEGER NOT NULL CHECK (guests_count > 0),
  contact_phone VARCHAR(32),
  special_requests TEXT,
  nights INTEGER NOT NULL CHECK (nights > 0),
  rate_per_night NUMERIC(12,2) NOT NULL CHECK (rate_per_night >= 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  transaction_uuid VARCHAR(64) NOT NULL UNIQUE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'initiated'
    CHECK (payment_status IN ('initiated', 'success', 'failed', 'expired')),
  booking_id INTEGER REFERENCES homestay_bookings(booking_id) ON DELETE SET NULL,
  payment_ref_id VARCHAR(128),
  payment_response JSONB,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_payment_booking_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_payment_sessions_tourist
  ON booking_payment_sessions(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_payment_sessions_booking
  ON booking_payment_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_payment_sessions_status
  ON booking_payment_sessions(payment_status, created_at DESC);
