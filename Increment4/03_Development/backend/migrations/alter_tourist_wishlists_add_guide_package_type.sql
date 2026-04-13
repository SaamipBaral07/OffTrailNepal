DO $$
DECLARE
  wishlist_check_name text;
BEGIN
  SELECT c.conname
    INTO wishlist_check_name
  FROM pg_constraint c
  WHERE c.conrelid = 'tourist_wishlists'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%item_type%'
  ORDER BY c.oid DESC
  LIMIT 1;

  IF wishlist_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tourist_wishlists DROP CONSTRAINT %I', wishlist_check_name);
  END IF;
END $$;

ALTER TABLE tourist_wishlists
  ADD CONSTRAINT tourist_wishlists_item_type_check
  CHECK (item_type IN ('trail', 'homestay', 'guide', 'guide_package'));
