
-- Add delivery_options column to listings (array of text: 'collect', 'courier', 'post')
ALTER TABLE public.listings ADD COLUMN delivery_options TEXT[] DEFAULT '{}'::TEXT[];

-- Add delivery_option to orders to track which method was chosen
ALTER TABLE public.orders ADD COLUMN delivery_option TEXT;

-- Add invoice number to orders
ALTER TABLE public.orders ADD COLUMN invoice_number TEXT;

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.invoice_number := 'OX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate invoice number on order creation
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invoice_number();
