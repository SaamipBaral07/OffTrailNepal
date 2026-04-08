-- ================================================
-- HOST VERIFICATION + HOMESTAY DOCUMENT REQUIREMENTS
-- ================================================

CREATE TABLE IF NOT EXISTS host_verifications (
    id                      SERIAL PRIMARY KEY,
    host_id                 INT NOT NULL UNIQUE REFERENCES hosts(host_id) ON DELETE CASCADE,
    citizenship_doc_path    TEXT NOT NULL,
    verification_status     TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    rejection_reason        TEXT,
    reviewed_by_admin_id    INT REFERENCES admins(admin_id) ON DELETE SET NULL,
    reviewed_at             TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_host_verifications_status ON host_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_host_verifications_reviewed_by ON host_verifications(reviewed_by_admin_id);

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS homestay_registration_certificate_doc_path TEXT;

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS property_ownership_doc_path TEXT;

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS property_ownership_type VARCHAR(16);

ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'homestays_property_ownership_type_check'
  ) THEN
    ALTER TABLE homestays
      ADD CONSTRAINT homestays_property_ownership_type_check
      CHECK (property_ownership_type IN ('owner', 'rental'));
  END IF;
END $$;
