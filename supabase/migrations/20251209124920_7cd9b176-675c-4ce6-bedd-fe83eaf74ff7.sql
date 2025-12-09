-- Add WhatsApp and LinkedIn fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN whatsapp_number text,
ADD COLUMN linkedin_url text;

-- Recreate the public_profiles view to include new fields
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
  linkedin_url
FROM public.profiles;