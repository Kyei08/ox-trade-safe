CREATE TABLE IF NOT EXISTS public.courier_availability_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_avail_hist_user
  ON public.courier_availability_history(user_id, changed_at DESC);

GRANT SELECT, INSERT ON public.courier_availability_history TO authenticated;
GRANT ALL ON public.courier_availability_history TO service_role;

ALTER TABLE public.courier_availability_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers view own availability history"
  ON public.courier_availability_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System inserts availability history"
  ON public.courier_availability_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_courier_availability_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.courier_available IS DISTINCT FROM OLD.courier_available THEN
    INSERT INTO public.courier_availability_history (user_id, available, changed_at)
    VALUES (NEW.id, COALESCE(NEW.courier_available, false), now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_courier_availability ON public.profiles;
CREATE TRIGGER trg_log_courier_availability
  AFTER UPDATE OF courier_available ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_courier_availability_change();