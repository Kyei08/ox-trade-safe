
-- Create order_status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status order_status NOT NULL DEFAULT 'paid',
  stripe_session_id TEXT,
  shipping_address TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Buyers can view their orders
CREATE POLICY "Buyers can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id);

-- Sellers can view orders for their listings
CREATE POLICY "Sellers can view their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);

-- Sellers can update order status (shipping, tracking)
CREATE POLICY "Sellers can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = seller_id);

-- System inserts orders (via edge function), but also allow authenticated users
CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
