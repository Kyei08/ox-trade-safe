-- Fix 1: Restrict profiles table to hide sensitive contact information
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a public view with only non-sensitive profile information
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT 
    id, 
    full_name, 
    bio, 
    avatar_url, 
    rating, 
    total_reviews, 
    created_at,
    kyc_status
  FROM public.profiles;

-- Grant access to the public view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Users can view their own full profile with sensitive data
CREATE POLICY "Users can view own full profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles (if needed for admin panel)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));