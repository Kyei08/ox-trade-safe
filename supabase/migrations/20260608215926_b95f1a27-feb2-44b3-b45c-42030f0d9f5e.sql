
-- Enums
DO $$ BEGIN
  CREATE TYPE public.seller_type AS ENUM ('individual', 'business');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.seller_verification_status AS ENUM ('not_started','pending_review','approved','rejected','requires_more_info');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_type public.seller_type,
  ADD COLUMN IF NOT EXISTS seller_verification_status public.seller_verification_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ;

-- Verification submissions table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_type public.seller_type NOT NULL,
  -- Individual
  full_name TEXT,
  physical_address TEXT,
  phone TEXT,
  -- Business
  company_name TEXT,
  registration_number TEXT,
  vat_number TEXT,
  representative_name TEXT,
  business_address TEXT,
  -- Document storage paths (in seller-verification bucket)
  id_document_path TEXT,
  selfie_path TEXT,
  proof_of_residence_path TEXT,
  cipc_document_path TEXT,
  representative_id_path TEXT,
  proof_of_business_address_path TEXT,
  proof_of_business_banking_path TEXT,
  -- Review
  status public.seller_verification_status NOT NULL DEFAULT 'pending_review',
  review_notes TEXT,
  requested_documents TEXT[],
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.seller_verifications TO authenticated;
GRANT ALL ON public.seller_verifications TO service_role;

ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners can view own verification"
  ON public.seller_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners can insert own verification"
  ON public.seller_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owners can update editable verification"
  ON public.seller_verifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending_review','requires_more_info','rejected'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins can update verification"
  ON public.seller_verifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_seller_verifications_updated_at ON public.seller_verifications;
CREATE TRIGGER update_seller_verifications_updated_at
  BEFORE UPDATE ON public.seller_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync profile when verification status changes
CREATE OR REPLACE FUNCTION public.sync_profile_seller_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET seller_type = NEW.seller_type,
      seller_verification_status = NEW.status,
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_seller_verification_trg ON public.seller_verifications;
CREATE TRIGGER sync_profile_seller_verification_trg
  AFTER INSERT OR UPDATE ON public.seller_verifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_seller_verification();

-- Storage bucket policies (bucket itself created via tool)
-- Owners can manage own files; admins can read all
CREATE POLICY "seller-verification owners upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "seller-verification owners read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seller-verification' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "seller-verification owners update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "seller-verification owners delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);
