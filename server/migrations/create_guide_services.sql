-- ================================================
-- GUIDE SERVICES TABLE
-- Guides can offer multiple service packages per trail
-- ================================================

CREATE TABLE IF NOT EXISTS guide_services (
    service_id      SERIAL PRIMARY KEY,
    guide_id        INT NOT NULL REFERENCES guides(guide_id) ON DELETE CASCADE,
    trail_id        INT NOT NULL REFERENCES trekking_trails(trail_id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    price_per_day   NUMERIC NOT NULL,
    max_group_size  INT DEFAULT 1,
    min_booking_days INT NOT NULL DEFAULT 1 CHECK (min_booking_days > 0),
    description     TEXT,
    is_active       BOOLEAN DEFAULT true,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_rejection_reason TEXT,
    reviewed_by_admin_id INT REFERENCES admins(admin_id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for public trail-based lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_guide_services_trail_active ON guide_services(trail_id, is_active);
CREATE INDEX IF NOT EXISTS idx_guide_services_approval_status ON guide_services(approval_status);
-- Index for guide's own service management
CREATE INDEX IF NOT EXISTS idx_guide_services_guide_id ON guide_services(guide_id);
