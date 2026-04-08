-- Ensure guide_availability supports ON CONFLICT (guide_id, available_date)

-- Keep newest row for each duplicate (guide_id, available_date) pair.
WITH duplicate_rows AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY guide_id, available_date
             ORDER BY id DESC
           ) AS row_num
    FROM guide_availability
  ) ranked
  WHERE ranked.row_num > 1
)
DELETE FROM guide_availability ga
USING duplicate_rows d
WHERE ga.id = d.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guide_availability_guide_date_unique'
      AND conrelid = 'guide_availability'::regclass
  ) THEN
    ALTER TABLE guide_availability
      ADD CONSTRAINT guide_availability_guide_date_unique
      UNIQUE (guide_id, available_date);
  END IF;
END $$;
