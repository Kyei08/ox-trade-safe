-- Public seller info view readable by every visitor (anon included).
-- Base table public.profiles stays locked to owner/admin (contains PII like email);
-- this owner-rights view is the deliberate security boundary and exposes only
-- public-safe seller fields (no email, no phone/WhatsApp number).
CREATE OR REPLACE VIEW public.public_seller_profiles AS
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

-- public_profiles keeps security_invoker=true (RLS-filtered); grants just make the
-- API behave consistently instead of returning permission errors.
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;