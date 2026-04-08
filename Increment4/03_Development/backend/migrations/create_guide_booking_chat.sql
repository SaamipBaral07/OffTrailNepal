-- Real-time chat persistence for paid guide-package bookings.

CREATE TABLE IF NOT EXISTS guide_booking_chat_messages (
  message_id BIGSERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES guide_package_bookings(booking_id) ON DELETE CASCADE,
  guide_id INTEGER NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
  tourist_id INTEGER NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('guide', 'tourist')),
  message_text TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_booking_chat_messages_booking_created
  ON guide_booking_chat_messages(booking_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_guide_booking_chat_messages_guide_unread
  ON guide_booking_chat_messages(guide_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_guide_booking_chat_messages_tourist_unread
  ON guide_booking_chat_messages(tourist_id, read_at)
  WHERE read_at IS NULL;
