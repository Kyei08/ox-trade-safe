
DROP POLICY IF EXISTS "Users can claim courier role when verified" ON public.user_roles;
CREATE POLICY "Users can claim courier role when verified"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'courier'::public.app_role
  AND EXISTS (
    SELECT 1 FROM public.seller_verifications sv
    WHERE sv.user_id = auth.uid() AND sv.status = 'approved'
  )
);

DROP POLICY IF EXISTS "Users can remove own courier role" ON public.user_roles;
CREATE POLICY "Users can remove own courier role"
ON public.user_roles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND role = 'courier'::public.app_role);

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
