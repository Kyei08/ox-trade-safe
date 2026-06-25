
-- Server-side validation for condition groups and options
CREATE OR REPLACE FUNCTION public.validate_category_condition_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_icon text;
BEGIN
  v_name := btrim(NEW.name);
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Group name cannot be empty' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_name) > 80 THEN
    RAISE EXCEPTION 'Group name must be 80 characters or fewer' USING ERRCODE = 'check_violation';
  END IF;
  NEW.name := v_name;

  IF NEW.sort_order IS NULL OR NEW.sort_order < 0 OR NEW.sort_order > 10000 THEN
    RAISE EXCEPTION 'Group sort_order must be between 0 and 10000' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.icon IS NOT NULL THEN
    v_icon := btrim(NEW.icon);
    IF length(v_icon) = 0 THEN
      NEW.icon := NULL;
    ELSE
      -- Must be PascalCase Lucide-style: letters/digits only, starting uppercase, 2-50 chars
      IF v_icon !~ '^[A-Z][A-Za-z0-9]{1,49}$' THEN
        RAISE EXCEPTION 'Icon name must be PascalCase Lucide identifier (letters/digits, starting uppercase, 2-50 chars). Got: %', v_icon
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.icon := v_icon;
    END IF;
  END IF;

  -- Uniqueness: case-insensitive group name within a category
  IF EXISTS (
    SELECT 1 FROM public.category_condition_groups g
    WHERE g.category_id = NEW.category_id
      AND lower(g.name) = lower(NEW.name)
      AND g.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'A condition group with this name already exists for this category' USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_category_condition_group ON public.category_condition_groups;
CREATE TRIGGER trg_validate_category_condition_group
  BEFORE INSERT OR UPDATE ON public.category_condition_groups
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_condition_group();

CREATE OR REPLACE FUNCTION public.validate_category_condition_option()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := btrim(NEW.name);
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Option name cannot be empty' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_name) > 60 THEN
    RAISE EXCEPTION 'Option name must be 60 characters or fewer' USING ERRCODE = 'check_violation';
  END IF;
  NEW.name := v_name;

  IF NEW.sort_order IS NULL OR NEW.sort_order < 0 OR NEW.sort_order > 10000 THEN
    RAISE EXCEPTION 'Option sort_order must be between 0 and 10000' USING ERRCODE = 'check_violation';
  END IF;

  -- Uniqueness: case-insensitive option name within a group
  IF EXISTS (
    SELECT 1 FROM public.category_condition_options o
    WHERE o.group_id = NEW.group_id
      AND lower(o.name) = lower(NEW.name)
      AND o.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'An option with this name already exists in this group' USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_category_condition_option ON public.category_condition_options;
CREATE TRIGGER trg_validate_category_condition_option
  BEFORE INSERT OR UPDATE ON public.category_condition_options
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_condition_option();
