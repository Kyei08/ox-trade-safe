-- Apply once the backend is resumed.
CREATE TABLE public.payfast_itn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  m_payment_id text,
  pf_payment_id text,
  payment_status text,
  amount_gross numeric,
  raw_body text NOT NULL,
  result text NOT NULL CHECK (result IN ('processed','ignored','failed')),
  failure_reason text,
  http_status int,
  source_ip text,
  retry_count int NOT NULL DEFAULT 0,
  last_retry_at timestamptz,
  last_retry_by uuid
);
CREATE INDEX payfast_itn_events_received_idx ON public.payfast_itn_events (received_at DESC);
CREATE INDEX payfast_itn_events_mpid_idx ON public.payfast_itn_events (m_payment_id);

GRANT SELECT ON public.payfast_itn_events TO authenticated;
GRANT ALL ON public.payfast_itn_events TO service_role;
ALTER TABLE public.payfast_itn_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ITN events" ON public.payfast_itn_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
