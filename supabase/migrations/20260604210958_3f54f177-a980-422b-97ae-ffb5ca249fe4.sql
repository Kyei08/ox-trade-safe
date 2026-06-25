
-- Add sort_order to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Seed a sensible initial order based on current alphabetical name
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM public.categories
)
UPDATE public.categories c SET sort_order = o.rn FROM ordered o WHERE c.id = o.id;

CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON public.categories(sort_order);

-- Allow admins to manage categories
CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage subcategories
CREATE POLICY "Admins can insert subcategories"
  ON public.subcategories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subcategories"
  ON public.subcategories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subcategories"
  ON public.subcategories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grant write privileges to authenticated (RLS still gates by role)
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
