
-- Restructure categories to canonical OX 9-category set + introduce subcategories
-- 1) Rename / update existing categories
UPDATE public.categories SET name='Electronics & Technology', slug='electronics-technology', icon='Smartphone' WHERE slug='electronics';
UPDATE public.categories SET name='Vehicles', slug='vehicles', icon='Car' WHERE slug='vehicles';
UPDATE public.categories SET name='Home & Garden', slug='home-garden', icon='Home' WHERE slug='home-garden';
UPDATE public.categories SET name='Fashion & Beauty', slug='fashion-beauty', icon='Shirt' WHERE slug='fashion';
UPDATE public.categories SET name='Collectibles', slug='collectibles', icon='Gem' WHERE slug='collectibles';
UPDATE public.categories SET name='Business & Industrial', slug='business-industrial', icon='Briefcase' WHERE slug='business';
UPDATE public.categories SET name='Other', slug='other', icon='Package' WHERE slug='other';

-- 2) Migrate any listings under legacy "Computers" into "Electronics & Technology", then remove it
UPDATE public.listings
SET category_id = (SELECT id FROM public.categories WHERE slug='electronics-technology')
WHERE category_id = (SELECT id FROM public.categories WHERE slug='computers');
DELETE FROM public.categories WHERE slug='computers';

-- 3) Insert new top-level categories
INSERT INTO public.categories (name, slug, icon) VALUES
  ('Agriculture & Livestock', 'agriculture-livestock', 'Sprout'),
  ('Property', 'property', 'Building2')
ON CONFLICT (slug) DO NOTHING;

-- 4) Subcategories table
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT ALL ON public.subcategories TO service_role;

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories are viewable by everyone"
  ON public.subcategories FOR SELECT
  USING (true);

-- 5) Add subcategory_id to listings (nullable so existing rows are unaffected)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listings_subcategory_id_idx ON public.listings(subcategory_id);
CREATE INDEX IF NOT EXISTS subcategories_category_id_idx ON public.subcategories(category_id);

-- 6) Seed example subcategories for Electronics & Technology and Collectibles
INSERT INTO public.subcategories (category_id, name, slug, sort_order)
SELECT c.id, v.name, v.slug, v.sort_order
FROM public.categories c
JOIN (VALUES
  ('Phones', 'phones', 1),
  ('Computers', 'computers', 2),
  ('Gaming', 'gaming', 3),
  ('Cameras', 'cameras', 4),
  ('Audio', 'audio', 5),
  ('Networking', 'networking', 6)
) AS v(name, slug, sort_order) ON true
WHERE c.slug = 'electronics-technology'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.subcategories (category_id, name, slug, sort_order)
SELECT c.id, v.name, v.slug, v.sort_order
FROM public.categories c
JOIN (VALUES
  ('Trading Cards', 'trading-cards', 1),
  ('Coins', 'coins', 2),
  ('Art', 'art', 3),
  ('Antiques', 'antiques', 4),
  ('Memorabilia', 'memorabilia', 5)
) AS v(name, slug, sort_order) ON true
WHERE c.slug = 'collectibles'
ON CONFLICT (category_id, slug) DO NOTHING;
