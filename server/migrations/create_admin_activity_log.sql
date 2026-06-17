CREATE TABLE IF NOT EXISTS admin_activity_log (
  activity_id BIGSERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(admin_id) ON DELETE SET NULL,
  action_type VARCHAR(150) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at
  ON admin_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id
  ON admin_activity_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action_type
  ON admin_activity_log(action_type);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity_type
  ON admin_activity_log(entity_type);
