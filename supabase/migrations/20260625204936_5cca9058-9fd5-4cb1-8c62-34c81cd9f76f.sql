CREATE TABLE public.listing_drafts (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_drafts TO authenticated;
GRANT ALL ON public.listing_drafts TO service_role;

ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own draft"
  ON public.listing_drafts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_listing_drafts_updated_at
  BEFORE UPDATE ON public.listing_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();