
-- Server-side enforcement: a listing may carry at most one option per single-select group.
-- Approach: BEFORE INSERT trigger removes any existing option from the same group on this listing
-- when the group is single-select. This keeps client UX (replacing the chip) and server invariants aligned.

CREATE OR REPLACE FUNCTION public.enforce_single_select_listing_condition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_is_multi boolean;
BEGIN
  SELECT o.group_id, g.is_multi_select
    INTO v_group_id, v_is_multi
  FROM public.category_condition_options o
  JOIN public.category_condition_groups g ON g.id = o.group_id
  WHERE o.id = NEW.option_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Unknown condition option %', NEW.option_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_is_multi IS FALSE THEN
    -- Drop any other option from the same single-select group for this listing.
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

DROP TRIGGER IF EXISTS trg_enforce_single_select_listing_condition ON public.listing_conditions;
CREATE TRIGGER trg_enforce_single_select_listing_condition
  BEFORE INSERT ON public.listing_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_select_listing_condition();
