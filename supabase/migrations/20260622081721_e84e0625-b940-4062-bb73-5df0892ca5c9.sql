
-- Audit table for failed/blocked booking attempts
CREATE TABLE public.logistics_booking_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID,
  courier_id UUID,
  reason TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.logistics_booking_attempts TO authenticated;
GRANT ALL ON public.logistics_booking_attempts TO service_role;

ALTER TABLE public.logistics_booking_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read booking attempts"
  ON public.logistics_booking_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages booking attempts"
  ON public.logistics_booking_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable dblink so we can write the audit row in an autonomous transaction
-- (the booking insert itself will be rolled back by the RAISE).
CREATE EXTENSION IF NOT EXISTS dblink;

CREATE OR REPLACE FUNCTION public.log_failed_booking_attempt(
  _customer_id UUID,
  _courier_id UUID,
  _reason TEXT,
  _payload JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conn TEXT := 'audit_' || gen_random_uuid()::text;
BEGIN
  PERFORM dblink_connect(v_conn, 'dbname=' || current_database());
  PERFORM dblink_exec(
    v_conn,
    format(
      'INSERT INTO public.logistics_booking_attempts (customer_id, courier_id, reason, payload) VALUES (%L, %L, %L, %L::jsonb)',
      _customer_id, _courier_id, _reason, _payload::text
    )
  );
  PERFORM dblink_disconnect(v_conn);
EXCEPTION WHEN OTHERS THEN
  -- Never let audit failure mask the original booking error
  BEGIN PERFORM dblink_disconnect(v_conn); EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_failed_booking_attempt(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Replace the booking guard to log before raising
CREATE OR REPLACE FUNCTION public.enforce_courier_available_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available BOOLEAN;
  v_reason TEXT;
BEGIN
  SELECT courier_available INTO v_available
  FROM public.profiles
  WHERE id = NEW.courier_id;

  IF v_available IS NOT TRUE THEN
    v_reason := CASE
      WHEN v_available IS NULL THEN 'courier_not_found_or_unset'
      ELSE 'courier_not_available'
    END;

    PERFORM public.log_failed_booking_attempt(
      NEW.customer_id,
      NEW.courier_id,
      v_reason,
      jsonb_build_object(
        'pickup_address', NEW.pickup_address,
        'dropoff_address', NEW.dropoff_address,
        'item_category', NEW.item_category,
        'size', NEW.size,
        'urgency', NEW.urgency,
        'price_cents', NEW.price_cents,
        'attempted_by', auth.uid()
      )
    );

    RAISE EXCEPTION 'Courier is not available right now'
      USING ERRCODE = 'check_violation',
            HINT = 'Bookings can only be created when the courier is marked Available now.';
  END IF;

  RETURN NEW;
END;
$$;
