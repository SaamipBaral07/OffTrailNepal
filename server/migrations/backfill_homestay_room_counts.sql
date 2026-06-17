-- ================================================
-- BACKFILL ROOM COUNTS FROM LEGACY DATA
-- ================================================

-- For legacy rows created before room columns existed,
-- backfill total_rooms and available_rooms from capacity when they are still default 1.
UPDATE homestays
SET total_rooms = CASE
      WHEN COALESCE(total_rooms, 1) = 1 AND COALESCE(capacity, 1) > 1 THEN capacity
      ELSE COALESCE(total_rooms, 1)
    END,
    available_rooms = CASE
      WHEN COALESCE(available_rooms, 1) = 1 AND COALESCE(capacity, 1) > 1 THEN capacity
      ELSE LEAST(COALESCE(available_rooms, 1), CASE WHEN COALESCE(total_rooms, 1) = 1 AND COALESCE(capacity, 1) > 1 THEN capacity ELSE COALESCE(total_rooms, 1) END)
    END;
