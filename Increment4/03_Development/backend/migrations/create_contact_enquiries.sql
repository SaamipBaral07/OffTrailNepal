CREATE TABLE IF NOT EXISTS contact_enquiries (
  enquiry_id SERIAL PRIMARY KEY,
  submitter_user_id INTEGER,
  submitter_user_type VARCHAR(20) CHECK (submitter_user_type IN ('tourist', 'host', 'guide', 'admin')),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(220) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'booking', 'host-support', 'guide-support', 'partnership')),
  message TEXT NOT NULL,
  source_ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_created_at
  ON contact_enquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_category_created
  ON contact_enquiries(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_submitter
  ON contact_enquiries(submitter_user_type, submitter_user_id, created_at DESC);