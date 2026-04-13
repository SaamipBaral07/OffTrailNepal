CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  conversation_id BIGSERIAL PRIMARY KEY,
  tourist_id INTEGER NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_tourist_last
  ON ai_chat_conversations (tourist_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  message_id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES ai_chat_conversations(conversation_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  provider VARCHAR(40),
  model VARCHAR(120),
  usage JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_created
  ON ai_chat_messages (conversation_id, created_at ASC);
