-- Ensure category↔condition_group integrity on listing_conditions for both INSERT and UPDATE,
-- with a friendly validation error. Remove duplicate trigger and add UPDATE coverage.

DROP TRIGGER IF EXISTS trg_enforce_single_select_listing_condition ON public.listing_conditions;
DROP TRIGGER IF EXISTS enforce_single_select_listing_condition ON public.listing_conditions;
DROP TRIGGER IF EXISTS enforce_listing_condition_category_match ON public.listing_conditions;

CREATE OR REPLACE FUNCTION public.enforce_single_select_listing_condition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group_id          uuid;
  v_group_category    uuid;
  v_listing_category  uuid;
  v_existing_option   uuid;
BEGIN
  -- Idempotency: identical (listing, option) pair is a no-op.
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.listing_conditions
    WHERE listing_id = NEW.listing_id
      AND option_id  = NEW.option_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Resolve the option's group + category.
  SELECT o.group_id, g.category_id
    INTO v_group_id, v_group_category
  FROM public.category_condition_options o
  JOIN public.category_condition_groups  g ON g.id = o.group_id
  WHERE o.id = NEW.option_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'That condition option no longer exists. Please pick another one.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Resolve the listing's category.
  SELECT category_id INTO v_listing_category
  FROM public.listings
  WHERE id = NEW.listing_id;

  IF v_listing_category IS NULL THEN
    RAISE EXCEPTION 'Listing not found.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Category integrity: the option's condition group must belong to the listing's category.
  IF v_group_category IS DISTINCT FROM v_listing_category THEN
    RAISE EXCEPTION 'The selected condition belongs to a different category than this listing. Please pick a condition from this listing''s category.'
      USING ERRCODE = 'check_violation',
            HINT    = 'condition_group_category_mismatch',
            DETAIL  = format('option=%s option_category=%s listing=%s listing_category=%s',
                             NEW.option_id, v_group_category, NEW.listing_id, v_listing_category);
  END IF;

  -- Single-select: only one condition per listing.
  SELECT option_id INTO v_existing_option
  FROM public.listing_conditions
  WHERE listing_id = NEW.listing_id
    AND option_id <> NEW.option_id
    AND (TG_OP = 'INSERT' OR option_id <> OLD.option_id)
  LIMIT 1;

  IF v_existing_option IS NOT NULL THEN
    RAISE EXCEPTION 'Only one condition can be selected per listing.'
      USING ERRCODE = 'check_violation',
            HINT    = 'single_select_violation',
            DETAIL  = format('listing=%s existing_option=%s attempted_option=%s',
                             NEW.listing_id, v_existing_option, NEW.option_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_single_select_listing_condition
BEFORE INSERT OR UPDATE ON public.listing_conditions
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_select_listing_condition();