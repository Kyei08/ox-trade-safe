
CREATE TABLE public.seller_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.seller_verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.seller_verification_documents TO authenticated;
GRANT ALL ON public.seller_verification_documents TO service_role;

ALTER TABLE public.seller_verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own document versions"
  ON public.seller_verification_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can insert own document versions"
  ON public.seller_verification_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update own document versions"
  ON public.seller_verification_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_svd_verification_field ON public.seller_verification_documents(verification_id, field_key, version DESC);
CREATE INDEX idx_svd_user ON public.seller_verification_documents(user_id, created_at DESC);

-- Backfill: seed one row per current document path on existing verifications.
INSERT INTO public.seller_verification_documents (verification_id, user_id, field_key, storage_path, version, is_current)
SELECT v.id, v.user_id, x.field_key, x.path, 1, TRUE
FROM public.seller_verifications v
CROSS JOIN LATERAL (VALUES
  ('id_document_path', v.id_document_path),
  ('selfie_path', v.selfie_path),
  ('proof_of_residence_path', v.proof_of_residence_path),
  ('cipc_document_path', v.cipc_document_path),
  ('representative_id_path', v.representative_id_path),
  ('proof_of_business_address_path', v.proof_of_business_address_path),
  ('proof_of_business_banking_path', v.proof_of_business_banking_path)
) AS x(field_key, path)
WHERE x.path IS NOT NULL;
