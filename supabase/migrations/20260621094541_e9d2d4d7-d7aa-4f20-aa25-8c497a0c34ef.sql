ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS courier_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS courier_available_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_courier_available_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.courier_available IS DISTINCT FROM OLD.courier_available THEN
    NEW.courier_available_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_courier_available ON public.profiles;
CREATE TRIGGER trg_touch_courier_available
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_courier_available_updated_at();