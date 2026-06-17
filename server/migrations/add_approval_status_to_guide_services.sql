ALTER TABLE guide_services
  ADD COLUMN IF NOT EXISTS approval_status TEXT,
  ADD COLUMN IF NOT EXISTS approval_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id INT REFERENCES admins(admin_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

UPDATE guide_services
SET approval_status = COALESCE(approval_status, 'pending')
WHERE approval_status IS NULL;

ALTER TABLE guide_services
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE guide_services
  ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guide_services_approval_status_check'
      AND conrelid = 'guide_services'::regclass
  ) THEN
    ALTER TABLE guide_services
      DROP CONSTRAINT guide_services_approval_status_check;
  END IF;
END $$;

ALTER TABLE guide_services
  ADD CONSTRAINT guide_services_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_guide_services_approval_status
  ON guide_services(approval_status);
