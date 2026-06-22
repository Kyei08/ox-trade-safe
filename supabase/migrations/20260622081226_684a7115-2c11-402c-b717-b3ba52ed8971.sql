
CREATE TABLE public.logistics_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  item_category TEXT,
  size TEXT,
  urgency TEXT,
  notes TEXT,
  price_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.logistics_bookings TO authenticated;
GRANT ALL ON public.logistics_bookings TO service_role;

ALTER TABLE public.logistics_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers create their own bookings"
  ON public.logistics_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Participants view their bookings"
  ON public.logistics_bookings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = courier_id);

CREATE POLICY "Courier updates assigned bookings"
  ON public.logistics_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = courier_id OR auth.uid() = customer_id)
  WITH CHECK (auth.uid() = courier_id OR auth.uid() = customer_id);

CREATE TRIGGER update_logistics_bookings_updated_at
  BEFORE UPDATE ON public.logistics_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce courier "Available now" at insert time. Bypasses the UI entirely.
CREATE OR REPLACE FUNCTION public.enforce_courier_available_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available BOOLEAN;
BEGIN
  SELECT courier_available INTO v_available
  FROM public.profiles
  WHERE id = NEW.courier_id;

  IF v_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Courier is not available right now'
      USING ERRCODE = 'check_violation',
            HINT = 'Bookings can only be created when the courier is marked Available now.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_courier_available_on_booking
  BEFORE INSERT ON public.logistics_bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_courier_available_on_booking();
