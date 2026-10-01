-- Pending: apply once the backend is resumed.
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view their orders" ON public.orders;
CREATE POLICY "Sellers can view their paid orders" ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = seller_id AND status NOT IN ('pending', 'cancelled'));
DROP POLICY IF EXISTS "Sellers can update orders" ON public.orders;
CREATE POLICY "Sellers can update paid orders" ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = seller_id AND status NOT IN ('pending', 'cancelled'))
WITH CHECK (auth.uid() = seller_id AND status IN ('paid', 'shipped', 'delivered'));
CREATE OR REPLACE FUNCTION public.guard_order_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
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
CREATE TRIGGER guard_order_payment_status BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_status();
