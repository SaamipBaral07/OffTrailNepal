-- ================================================
-- GUIDE MARKETPLACE SCHEMA
-- ================================================

-- 1. guide_trails: Links guides to trekking trails
CREATE TABLE IF NOT EXISTS guide_trails (
    id              SERIAL PRIMARY KEY,
    guide_id        INT NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
    trail_id        INT NOT NULL REFERENCES trekking_trails(trail_id) ON DELETE CASCADE,
    experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'expert')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (guide_id, trail_id)
);

-- 2. guide_availability: Future-ready availability tracking
CREATE TABLE IF NOT EXISTS guide_availability (
    id              SERIAL PRIMARY KEY,
    guide_id        INT NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
    available_date  DATE NOT NULL,
    is_available    BOOLEAN DEFAULT true
);

-- 3. guide_reviews: Future-ready review system
CREATE TABLE IF NOT EXISTS guide_reviews (
    review_id       SERIAL PRIMARY KEY,
    guide_id        INT NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
    user_id         INT NOT NULL,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_guide_trails_guide_id ON guide_trails(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_trails_trail_id ON guide_trails(trail_id);
CREATE INDEX IF NOT EXISTS idx_guide_trails_active   ON guide_trails(trail_id, is_active);
CREATE INDEX IF NOT EXISTS idx_guide_availability_guide ON guide_availability(guide_id, available_date);
CREATE INDEX IF NOT EXISTS idx_guide_reviews_guide   ON guide_reviews(guide_id);
