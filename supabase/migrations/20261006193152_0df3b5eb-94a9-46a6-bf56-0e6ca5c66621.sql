ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS needs_admin_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(_order_id uuid, _pf_payment_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order public.orders%ROWTYPE;
  _listing_status listing_status;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF _order.status <> 'pending' THEN RETURN 'already_' || _order.status; END IF;

  -- Lock the listing row so two confirmations cannot both win.
  SELECT status INTO _listing_status FROM public.listings WHERE id = _order.listing_id FOR UPDATE;

  IF _listing_status = 'active' OR (_listing_status = 'sold' AND NOT EXISTS (
       SELECT 1 FROM public.orders o WHERE o.listing_id = _order.listing_id AND o.id <> _order.id
         AND o.status IN ('paid','shipped','delivered'))) THEN
    UPDATE public.orders SET status = 'paid', payfast_payment_id = _pf_payment_id,
      needs_admin_review = false, review_reason = NULL WHERE id = _order.id;
    UPDATE public.listings SET status = 'sold' WHERE id = _order.listing_id;
    RETURN 'confirmed';
  END IF;

  UPDATE public.orders SET payfast_payment_id = _pf_payment_id, needs_admin_review = true,
    review_reason = 'Payment received but listing no longer available (status: ' || _listing_status || '). Refund or resolve manually.'
  WHERE id = _order.id;
  RETURN 'conflict';
END; $$;
REVOKE EXECUTE ON FUNCTION public.confirm_payfast_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payfast_payment(uuid, text) TO service_role;