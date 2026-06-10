
CREATE TABLE public.seller_verification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.seller_verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  actor_id UUID,
  event_type TEXT NOT NULL,
  status_from public.seller_verification_status,
  status_to public.seller_verification_status,
  requested_documents TEXT[],
  review_notes TEXT,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.seller_verification_audit_log TO authenticated;
GRANT ALL ON public.seller_verification_audit_log TO service_role;

ALTER TABLE public.seller_verification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit log entries"
  ON public.seller_verification_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can view own audit log entries"
  ON public.seller_verification_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_sv_audit_verification ON public.seller_verification_audit_log(verification_id, created_at DESC);
CREATE INDEX idx_sv_audit_user ON public.seller_verification_audit_log(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_seller_verification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'submitted';
    INSERT INTO public.seller_verification_audit_log
      (verification_id, user_id, actor_id, event_type, status_from, status_to, requested_documents, review_notes, snapshot)
    VALUES
      (NEW.id, NEW.user_id, v_actor, v_event, NULL, NEW.status, NEW.requested_documents, NEW.review_notes,
       jsonb_build_object('seller_type', NEW.seller_type));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_event := CASE NEW.status
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'requires_more_info' THEN 'more_info_requested'
        WHEN 'pending_review' THEN
          CASE WHEN OLD.status IN ('rejected','requires_more_info') THEN 'resubmitted' ELSE 'status_changed' END
        ELSE 'status_changed'
      END;
    ELSIF OLD.updated_at IS DISTINCT FROM NEW.updated_at THEN
      v_event := 'updated';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.seller_verification_audit_log
      (verification_id, user_id, actor_id, event_type, status_from, status_to, requested_documents, review_notes, snapshot)
    VALUES
      (NEW.id, NEW.user_id, v_actor, v_event, OLD.status, NEW.status, NEW.requested_documents, NEW.review_notes, NULL);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_seller_verification_event ON public.seller_verifications;
CREATE TRIGGER trg_log_seller_verification_event
AFTER INSERT OR UPDATE ON public.seller_verifications
FOR EACH ROW EXECUTE FUNCTION public.log_seller_verification_event();
