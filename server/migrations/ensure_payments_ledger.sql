-- Ensure canonical payment ledger table exists and is indexed for one-row-per-booking records

CREATE TABLE IF NOT EXISTS payments (
  payment_id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES homestay_bookings(booking_id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'success',
  transaction_reference VARCHAR(100),
  paid_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
  fk_target_table TEXT;
BEGIN
  SELECT ccu.table_name
  INTO fk_target_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'payments'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'booking_id'
  LIMIT 1;

  IF fk_target_table IS DISTINCT FROM 'homestay_bookings' THEN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;
    ALTER TABLE payments
      ADD CONSTRAINT payments_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES homestay_bookings(booking_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_booking_unique
  ON payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at_desc
  ON payments(paid_at DESC);
