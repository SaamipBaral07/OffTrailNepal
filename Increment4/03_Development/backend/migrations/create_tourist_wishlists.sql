CREATE TABLE IF NOT EXISTS tourist_wishlists (
  wishlist_id SERIAL PRIMARY KEY,
  tourist_id INT NOT NULL REFERENCES tourists(tourist_id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('trail', 'homestay', 'guide')),
  item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tourist_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_tourist_wishlists_tourist_created
  ON tourist_wishlists(tourist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tourist_wishlists_type_item
  ON tourist_wishlists(item_type, item_id);
