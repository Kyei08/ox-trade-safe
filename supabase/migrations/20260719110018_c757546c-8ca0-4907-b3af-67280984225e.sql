ALTER TABLE public.category_condition_options
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS examples text;