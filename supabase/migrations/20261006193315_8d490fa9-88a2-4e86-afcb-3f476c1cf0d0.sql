ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_started'
    CHECK (refund_status IN ('not_started','in_progress','refunded','resolved_other')),
  ADD COLUMN IF NOT EXISTS refund_reference text,
  ADD COLUMN IF NOT EXISTS refund_notes text,
  ADD COLUMN IF NOT EXISTS refund_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_updated_by uuid;