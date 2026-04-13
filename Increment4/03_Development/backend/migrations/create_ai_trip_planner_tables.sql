CREATE TABLE IF NOT EXISTS ai_trip_plans (
  plan_id BIGSERIAL PRIMARY KEY,
  requester_user_id INTEGER NOT NULL,
  requester_user_type VARCHAR(20) NOT NULL
    CHECK (requester_user_type IN ('tourist', 'host', 'guide', 'admin')),
  request_payload JSONB NOT NULL,
  candidate_snapshot JSONB NOT NULL,
  generated_plan JSONB NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'fallback',
  model VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'fallback', 'failed')),
  total_estimated_cost NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_trip_plans_requester
  ON ai_trip_plans (requester_user_type, requester_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_trip_plans_created
  ON ai_trip_plans (created_at DESC);

CREATE TABLE IF NOT EXISTS ai_trip_plan_feedback (
  feedback_id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES ai_trip_plans(plan_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL,
  feedback_type VARCHAR(20) NOT NULL
    CHECK (feedback_type IN ('like', 'dislike', 'edited', 'booked')),
  feedback_notes TEXT,
  edited_plan JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plan_id, tourist_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_trip_plan_feedback_plan
  ON ai_trip_plan_feedback (plan_id, created_at DESC);
