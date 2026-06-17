-- Guide marketplace transactional split:
-- 1) guide_trails remains informational (no price)
-- 2) guide_services remains transactional
-- 3) create guide package booking + payment session tables

BEGIN;

ALTER TABLE IF EXISTS guide_trails
  DROP COLUMN IF EXISTS price_per_day;

CREATE TABLE IF NOT EXISTS guide_package_bookings (
  booking_id SERIAL PRIMARY KEY,
  booking_code VARCHAR(24) NOT NULL UNIQUE,
  service_id INTEGER NOT NULL REFERENCES guide_services(service_id) ON DELETE CASCADE,
  guide_id INTEGER NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  trail_id INTEGER NOT NULL REFERENCES trekking_trails(trail_id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  participants_count INTEGER NOT NULL CHECK (participants_count > 0),
  contact_phone VARCHAR(32),
  special_requests TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'refund_requested', 'refunded')),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  CONSTRAINT chk_guide_package_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_guide_package_bookings_tourist
  ON guide_package_bookings(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_package_bookings_guide
  ON guide_package_bookings(guide_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_package_bookings_service
  ON guide_package_bookings(service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_package_bookings_status
  ON guide_package_bookings(status);

CREATE TABLE IF NOT EXISTS guide_package_payment_sessions (
  session_id SERIAL PRIMARY KEY,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES guide_services(service_id) ON DELETE CASCADE,
  guide_id INTEGER NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
  trail_id INTEGER NOT NULL REFERENCES trekking_trails(trail_id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  participants_count INTEGER NOT NULL CHECK (participants_count > 0),
  contact_phone VARCHAR(32),
  special_requests TEXT,
  total_days INTEGER NOT NULL CHECK (total_days > 0),
  rate_per_day NUMERIC(12,2) NOT NULL CHECK (rate_per_day >= 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  transaction_uuid VARCHAR(64) NOT NULL UNIQUE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'initiated'
    CHECK (payment_status IN ('initiated', 'success', 'failed', 'expired', 'refund_requested', 'refunded')),
  booking_id INTEGER REFERENCES guide_package_bookings(booking_id) ON DELETE SET NULL,
  payment_ref_id VARCHAR(128),
  payment_response JSONB,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_guide_payment_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_guide_package_payment_sessions_tourist
  ON guide_package_payment_sessions(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_package_payment_sessions_booking
  ON guide_package_payment_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_guide_package_payment_sessions_status
  ON guide_package_payment_sessions(payment_status, created_at DESC);

COMMIT;
