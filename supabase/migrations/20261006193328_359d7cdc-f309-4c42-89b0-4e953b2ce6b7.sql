CREATE OR REPLACE FUNCTION public.guard_order_refund_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    IF NEW.refund_status IS DISTINCT FROM OLD.refund_status OR NEW.refund_reference IS DISTINCT FROM OLD.refund_reference
       OR NEW.refund_notes IS DISTINCT FROM OLD.refund_notes THEN
      NEW.refund_updated_at := now();
      NEW.refund_updated_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.refund_status IS DISTINCT FROM OLD.refund_status OR NEW.refund_reference IS DISTINCT FROM OLD.refund_reference
     OR NEW.refund_notes IS DISTINCT FROM OLD.refund_notes OR NEW.refund_updated_at IS DISTINCT FROM OLD.refund_updated_at
     OR NEW.refund_updated_by IS DISTINCT FROM OLD.refund_updated_by
     OR NEW.needs_admin_review IS DISTINCT FROM OLD.needs_admin_review OR NEW.review_reason IS DISTINCT FROM OLD.review_reason THEN
    RAISE EXCEPTION 'Only admins can change refund details';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_order_refund_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_order_refund_fields ON public.orders;
CREATE TRIGGER guard_order_refund_fields BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_refund_fields();