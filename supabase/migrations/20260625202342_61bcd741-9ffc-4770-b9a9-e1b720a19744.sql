
-- Extend the listing_conditions BEFORE INSERT guard with two more invariants:
--   1) idempotent insert: same (listing_id, option_id) is a no-op instead of a PK error
--   2) category integrity: option's group must belong to the listing's category

CREATE OR REPLACE FUNCTION public.enforce_single_select_listing_condition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id      uuid;
  v_is_multi      boolean;
  v_group_category uuid;
  v_listing_category uuid;
BEGIN
  -- 1) Idempotency: if the exact pair already exists, swallow the insert.
  IF EXISTS (
    SELECT 1 FROM public.listing_conditions
    WHERE listing_id = NEW.listing_id
      AND option_id  = NEW.option_id
  ) THEN
    RETURN NULL; -- skip duplicate, no error
  END IF;

  -- Resolve the option's group + category and the listing's category.
  SELECT o.group_id, g.is_multi_select, g.category_id
    INTO v_group_id, v_is_multi, v_group_category
  FROM public.category_condition_options o
  JOIN public.category_condition_groups  g ON g.id = o.group_id
  WHERE o.id = NEW.option_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Unknown condition option %', NEW.option_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT category_id INTO v_listing_category
  FROM public.listings
  WHERE id = NEW.listing_id;

  IF v_listing_category IS NULL THEN
    RAISE EXCEPTION 'Unknown listing %', NEW.listing_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 2) Category integrity.
  IF v_group_category IS DISTINCT FROM v_listing_category THEN
    RAISE EXCEPTION 'Condition option % belongs to a different category than listing %', NEW.option_id, NEW.listing_id
      USING ERRCODE = 'check_violation',
            HINT    = 'Only attach options whose group.category_id matches the listing.category_id.';
  END IF;

  -- 3) Existing rule: at most one option per single-select group on a listing.
  IF v_is_multi IS FALSE THEN
    DELETE FROM public.listing_conditions lc
    USING public.category_condition_options o
    WHERE lc.listing_id = NEW.listing_id
      AND lc.option_id  = o.id
      AND lc.option_id <> NEW.option_id
      AND o.group_id    = v_group_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_single_select_listing_condition() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_single_select_listing_condition() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_single_select_listing_condition() FROM authenticated;

-- Trigger already exists from the previous migration; no re-create needed.
