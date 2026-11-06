DROP VIEW IF EXISTS public.public_seller_profiles;

-- Owner-rights view is a strict allowlist for fields intended for seller discovery.
-- Do not expose email, phone/WhatsApp number, addresses, or banking details.
CREATE VIEW public.public_seller_profiles
WITH (security_barrier = true)
AS
  SELECT id,
         full_name,
         avatar_url,
         bio,
         rating,
         total_reviews,
         seller_type,
         seller_verification_status,
         kyc_status,
         phone_verified_at,
         address_verified_at,
         twitter_url,
         facebook_url,
         instagram_url,
         tiktok_url,
         youtube_url,
         linkedin_url,
         website_url,
         created_at
  FROM public.profiles;

GRANT SELECT ON public.public_seller_profiles TO anon, authenticated, service_role;
REVOKE SELECT ON public.public_profiles FROM anon;