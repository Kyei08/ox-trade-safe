-- Add website_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN website_url text;

-- Drop and recreate public_profiles view to include website_url
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
  twitter_url,
  facebook_url,
  instagram_url,
  whatsapp_number,
  linkedin_url,
  tiktok_url,
  youtube_url,
  website_url
FROM public.profiles;