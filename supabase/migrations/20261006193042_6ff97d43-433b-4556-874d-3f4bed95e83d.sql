ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view their paid orders" ON public.orders;
CREATE POLICY "Sellers can view their paid orders" ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = seller_id AND status NOT IN ('pending', 'cancelled'));
DROP POLICY IF EXISTS "Sellers can update orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update paid orders" ON public.orders;
CREATE POLICY "Sellers can update paid orders" ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = seller_id AND status NOT IN ('pending', 'cancelled'))
WITH CHECK (auth.uid() = seller_id AND status IN ('paid', 'shipped', 'delivered'));

CREATE OR REPLACE FUNCTION public.guard_order_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'Orders must start as pending payment'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (OLD.status IN ('pending', 'cancelled') OR NEW.status IN ('pending', 'cancelled', 'refunded')) THEN
    RAISE EXCEPTION 'Payment status can only be changed by the payment system';
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.payfast_payment_id IS DISTINCT FROM OLD.payfast_payment_id
     OR NEW.m_payment_id IS DISTINCT FROM OLD.m_payment_id OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN
    RAISE EXCEPTION 'Payment details cannot be changed';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_order_payment_status ON public.orders;
CREATE TRIGGER guard_order_payment_status BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_status();

CREATE TABLE IF NOT EXISTS public.payfast_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  m_payment_id text NOT NULL,
  pf_payment_id text,
  payment_status text,
  amount_gross numeric,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pf_payment_id, payment_status, amount_gross)
);
GRANT SELECT ON public.payfast_transactions TO authenticated;
GRANT ALL ON public.payfast_transactions TO service_role;
ALTER TABLE public.payfast_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view PayFast transactions" ON public.payfast_transactions;
CREATE POLICY "Admins can view PayFast transactions" ON public.payfast_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.payfast_itn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  m_payment_id text, pf_payment_id text, payment_status text, amount_gross numeric,
  raw_body text NOT NULL,
  result text NOT NULL CHECK (result IN ('processed','ignored','failed')),
  failure_reason text, http_status int, source_ip text,
  retry_count int NOT NULL DEFAULT 0, last_retry_at timestamptz, last_retry_by uuid
);
CREATE INDEX IF NOT EXISTS payfast_itn_events_received_idx ON public.payfast_itn_events (received_at DESC);
CREATE INDEX IF NOT EXISTS payfast_itn_events_mpid_idx ON public.payfast_itn_events (m_payment_id);
GRANT SELECT ON public.payfast_itn_events TO authenticated;
GRANT ALL ON public.payfast_itn_events TO service_role;
ALTER TABLE public.payfast_itn_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view ITN events" ON public.payfast_itn_events;
CREATE POLICY "Admins can view ITN events" ON public.payfast_itn_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));