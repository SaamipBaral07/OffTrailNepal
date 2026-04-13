DO $$
DECLARE
  unique_constraint_name text;
BEGIN
  SELECT c.conname
  INTO unique_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'tourist_platform_reviews'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%(tourist_id)%'
  LIMIT 1;

  IF unique_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.tourist_platform_reviews DROP CONSTRAINT %I',
      unique_constraint_name
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tourist_platform_reviews_tourist_created
  ON tourist_platform_reviews(tourist_id, created_at DESC);
