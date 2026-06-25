
-- Composite indexes for common Listings filters/sorts
CREATE INDEX IF NOT EXISTS idx_listings_status_category_created
  ON public.listings (status, category_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_subcategory_created
  ON public.listings (status, subcategory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON public.listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_type_created
  ON public.listings (status, listing_type, created_at DESC);

-- Ending-soon sort path (auction listings only)
CREATE INDEX IF NOT EXISTS idx_listings_status_auction_ends
  ON public.listings (status, auction_ends_at)
  WHERE listing_type = 'auction';

-- Price sorts
CREATE INDEX IF NOT EXISTS idx_listings_status_price_asc
  ON public.listings (status, fixed_price);

-- Covering index so listing_conditions -> listings lookup is index-only
CREATE INDEX IF NOT EXISTS idx_listing_conditions_option_listing
  ON public.listing_conditions (option_id, listing_id);
