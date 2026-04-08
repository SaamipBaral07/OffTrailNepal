ALTER TABLE contact_enquiries
  ADD COLUMN IF NOT EXISTS admin_reply_message TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply_admin_id INTEGER,
  ADD COLUMN IF NOT EXISTS admin_reply_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_reply_read_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_admin_reply_at
  ON contact_enquiries(admin_reply_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_reply_unread
  ON contact_enquiries(submitter_user_type, submitter_user_id, admin_reply_read_at)
  WHERE admin_reply_message IS NOT NULL;