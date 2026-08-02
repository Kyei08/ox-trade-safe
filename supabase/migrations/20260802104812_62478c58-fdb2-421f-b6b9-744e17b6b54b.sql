ALTER TABLE public.category_condition_options
  ADD COLUMN IF NOT EXISTS description_b text,
  ADD COLUMN IF NOT EXISTS examples_b text,
  ADD COLUMN IF NOT EXISTS help_experiment_enabled boolean NOT NULL DEFAULT false;