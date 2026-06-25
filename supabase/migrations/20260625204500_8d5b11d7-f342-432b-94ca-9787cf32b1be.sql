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
  -- 1) Idempotency: identical (listing, option) pair is a no-op.
  IF EXISTS (
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
    RAISE EXCEPTION 'Unknown condition option %', NEW.option_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Resolve the listing's category.
  SELECT category_id INTO v_listing_category
  FROM public.listings
  WHERE id = NEW.listing_id;

  IF v_listing_category IS NULL THEN
    RAISE EXCEPTION 'Unknown listing %', NEW.listing_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 2) Category integrity: option's group category must match listing category.
  IF v_group_category IS DISTINCT FROM v_listing_category THEN
    RAISE EXCEPTION 'Condition option does not belong to this listing''s category'
      USING ERRCODE = 'check_violation',
            HINT    = 'The selected condition belongs to a different category than the listing.',
            DETAIL  = format('option=%s option_category=%s listing=%s listing_category=%s',
                             NEW.option_id, v_group_category, NEW.listing_id, v_listing_category);
  END IF;

  -- 3) Single-select across the entire listing: reject if another option is already attached.
  SELECT option_id INTO v_existing_option
  FROM public.listing_conditions
  WHERE listing_id = NEW.listing_id
    AND option_id <> NEW.option_id
  LIMIT 1;

  IF v_existing_option IS NOT NULL THEN
    RAISE EXCEPTION 'A listing can only have one condition selected'
      USING ERRCODE = 'check_violation',
            HINT    = 'Remove the existing condition before attaching a different one.',
            DETAIL  = format('listing=%s existing_option=%s attempted_option=%s',
                             NEW.listing_id, v_existing_option, NEW.option_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger is attached (idempotent).
DROP TRIGGER IF EXISTS enforce_single_select_listing_condition ON public.listing_conditions;
CREATE TRIGGER enforce_single_select_listing_condition
BEFORE INSERT ON public.listing_conditions
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_select_listing_condition();