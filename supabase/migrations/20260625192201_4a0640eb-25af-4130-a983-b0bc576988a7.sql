
CREATE TABLE public.category_condition_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  is_multi_select BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ccg_category ON public.category_condition_groups(category_id);

GRANT SELECT ON public.category_condition_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_condition_groups TO authenticated;
GRANT ALL ON public.category_condition_groups TO service_role;
ALTER TABLE public.category_condition_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view condition groups" ON public.category_condition_groups FOR SELECT USING (true);
CREATE POLICY "Admins manage condition groups" ON public.category_condition_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.category_condition_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.category_condition_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cco_group ON public.category_condition_options(group_id);

GRANT SELECT ON public.category_condition_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_condition_options TO authenticated;
GRANT ALL ON public.category_condition_options TO service_role;
ALTER TABLE public.category_condition_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view condition options" ON public.category_condition_options FOR SELECT USING (true);
CREATE POLICY "Admins manage condition options" ON public.category_condition_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
