-- Add location field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN location text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.location IS 'User location (city/province in South Africa)';