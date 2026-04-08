-- ================================================
-- GUIDE VERIFICATION DOCUMENT WORKFLOW
-- ================================================

CREATE TABLE IF NOT EXISTS guide_verifications (
    id                      SERIAL PRIMARY KEY,
    guide_id                INT NOT NULL UNIQUE REFERENCES guides(guide_id) ON DELETE CASCADE,
    citizenship_doc_path    TEXT NOT NULL,
    guide_license_doc_path  TEXT NOT NULL,
    verification_status     TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    rejection_reason        TEXT,
    reviewed_by_admin_id    INT REFERENCES admins(admin_id) ON DELETE SET NULL,
    reviewed_at             TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_verifications_status ON guide_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_guide_verifications_reviewed_by ON guide_verifications(reviewed_by_admin_id);
