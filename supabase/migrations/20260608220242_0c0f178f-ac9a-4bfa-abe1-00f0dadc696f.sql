
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, full_name, avatar_url, bio, rating, total_reviews, created_at, kyc_status,
  twitter_url, facebook_url, instagram_url, whatsapp_number, linkedin_url,
  tiktok_url, youtube_url, website_url,
  seller_type, seller_verification_status, phone_verified_at, address_verified_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
