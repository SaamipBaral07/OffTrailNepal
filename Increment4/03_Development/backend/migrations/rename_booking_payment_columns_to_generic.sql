-- Rename provider-specific payment columns to provider-neutral names.
-- Safe to run multiple times.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_payment_sessions'
      AND column_name = 'esewa_ref_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_payment_sessions'
      AND column_name = 'payment_ref_id'
  ) THEN
    ALTER TABLE booking_payment_sessions
      RENAME COLUMN esewa_ref_id TO payment_ref_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_payment_sessions'
      AND column_name = 'esewa_response'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_payment_sessions'
      AND column_name = 'payment_response'
  ) THEN
    ALTER TABLE booking_payment_sessions
      RENAME COLUMN esewa_response TO payment_response;
  END IF;
END $$;

COMMIT;
