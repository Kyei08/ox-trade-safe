
-- Tighten the INSERT policy so only the target user or triggers can insert
DROP POLICY "Authenticated users can receive notifications" ON public.notifications;

CREATE POLICY "Users can receive notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
