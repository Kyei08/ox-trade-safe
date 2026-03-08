
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert notifications (via service role / triggers)
CREATE POLICY "Authenticated users can receive notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create trigger function to notify on new bid
CREATE OR REPLACE FUNCTION public.notify_on_new_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_bidder_name TEXT;
BEGIN
  -- Get listing info
  SELECT title, seller_id INTO v_listing FROM public.listings WHERE id = NEW.listing_id;
  
  -- Get bidder name
  SELECT COALESCE(full_name, email) INTO v_bidder_name FROM public.profiles WHERE id = NEW.bidder_id;

  -- Notify the seller
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_listing.seller_id,
    'new_bid',
    'New Bid Received',
    v_bidder_name || ' placed a bid of R ' || NEW.amount || ' on "' || v_listing.title || '"',
    '/listing/' || NEW.listing_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_bid();

-- Create trigger function to notify on new message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_sender_name TEXT;
  v_recipient_id UUID;
BEGIN
  -- Get conversation info
  SELECT buyer_id, seller_id INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  
  -- Get sender name
  SELECT COALESCE(full_name, email) INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  
  -- Determine recipient
  IF NEW.sender_id = v_conv.buyer_id THEN
    v_recipient_id := v_conv.seller_id;
  ELSE
    v_recipient_id := v_conv.buyer_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_recipient_id,
    'new_message',
    'New Message',
    v_sender_name || ' sent you a message',
    '/messages/' || NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- Notify when order status changes
CREATE OR REPLACE FUNCTION public.notify_on_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_title TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT title INTO v_listing_title FROM public.listings WHERE id = NEW.listing_id;
    
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.buyer_id,
      'order_update',
      'Order Updated',
      'Your order for "' || v_listing_title || '" is now ' || NEW.status,
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_update();
