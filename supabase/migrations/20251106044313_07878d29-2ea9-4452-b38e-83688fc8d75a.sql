-- Create reviews table
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, listing_id, reviewed_user_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews
FOR SELECT
USING (true);

CREATE POLICY "Users can create reviews for completed transactions"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id AND
  reviewer_id != reviewed_user_id AND
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = listing_id
    AND (
      -- For auctions: reviewer must be the winning bidder or the seller
      (listing_type = 'auction' AND status = 'sold' AND (
        seller_id = reviewed_user_id OR
        EXISTS (
          SELECT 1 FROM public.bids
          WHERE listing_id = listings.id
          AND bidder_id = reviewer_id
          AND is_winning = true
        )
      )) OR
      -- For fixed price: reviewer must be involved in transaction (simplified check)
      (listing_type = 'fixed_price' AND status = 'sold')
    )
  )
);

CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = reviewer_id);

-- Function to update profile ratings
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the reviewed user's profile with new average rating and count
  UPDATE public.profiles
  SET 
    rating = COALESCE((
      SELECT AVG(rating)::numeric(3,2)
      FROM public.reviews
      WHERE reviewed_user_id = NEW.reviewed_user_id
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE reviewed_user_id = NEW.reviewed_user_id
    ),
    updated_at = now()
  WHERE id = NEW.reviewed_user_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update ratings on new review
CREATE TRIGGER update_profile_rating_on_review
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_rating();

-- Add updated_at trigger for reviews
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_reviews_reviewed_user ON public.reviews(reviewed_user_id);
CREATE INDEX idx_reviews_listing ON public.reviews(listing_id);