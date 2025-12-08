-- Add social media columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN facebook_url text,
ADD COLUMN instagram_url text,
ADD COLUMN twitter_url text;

-- Update the public_profiles view to include social media links
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  bio,
  rating,
  total_reviews,
  created_at,
  kyc_status,
  facebook_url,
  instagram_url,
  twitter_url
FROM public.profiles;