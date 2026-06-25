
-- 1. Add slug to condition options
ALTER TABLE public.category_condition_options
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Slug generator + auto-fill trigger
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(_input,'')), '[^a-z0-9]+', '-', 'g'),
             '-+', '-', 'g'
           )
         );
$$;

CREATE OR REPLACE FUNCTION public.set_condition_option_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_n int := 1;
BEGIN
  v_base := public.slugify(coalesce(nullif(btrim(NEW.slug), ''), NEW.name));
  IF v_base IS NULL OR length(v_base) = 0 THEN
    v_base := 'option';
  END IF;
  v_slug := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.category_condition_options
    WHERE group_id = NEW.group_id AND slug = v_slug AND id <> NEW.id
  ) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;
  NEW.slug := v_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_condition_option_slug ON public.category_condition_options;
CREATE TRIGGER trg_set_condition_option_slug
  BEFORE INSERT OR UPDATE ON public.category_condition_options
  FOR EACH ROW EXECUTE FUNCTION public.set_condition_option_slug();

-- Backfill existing rows (trigger handles uniqueness)
UPDATE public.category_condition_options SET name = name;

ALTER TABLE public.category_condition_options
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_condition_option_slug_per_group
  ON public.category_condition_options(group_id, slug);

-- 2. Listing conditions junction
CREATE TABLE IF NOT EXISTS public.listing_conditions (
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES public.category_condition_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, option_id)
);

GRANT SELECT ON public.listing_conditions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_conditions TO authenticated;
GRANT ALL ON public.listing_conditions TO service_role;

ALTER TABLE public.listing_conditions ENABLE ROW LEVEL SECURITY;

-- Anyone can read (listings are public)
CREATE POLICY "listing_conditions_public_read"
  ON public.listing_conditions FOR SELECT
  USING (true);

-- Only the listing's seller can insert/update/delete its conditions
CREATE POLICY "listing_conditions_seller_insert"
  ON public.listing_conditions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.seller_id = auth.uid()
  ));

CREATE POLICY "listing_conditions_seller_delete"
  ON public.listing_conditions FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.seller_id = auth.uid()
  ));

CREATE POLICY "listing_conditions_seller_update"
  ON public.listing_conditions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.seller_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_listing_conditions_option ON public.listing_conditions(option_id);
