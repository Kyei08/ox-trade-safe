ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'payfast',
  ADD COLUMN IF NOT EXISTS payfast_payment_id text,
  ADD COLUMN IF NOT EXISTS m_payment_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_m_payment_id_key ON public.orders (m_payment_id) WHERE m_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payfast_payment_id_key ON public.orders (payfast_payment_id) WHERE payfast_payment_id IS NOT NULL;