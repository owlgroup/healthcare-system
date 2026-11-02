-- Staff (admin + doctor) can read all user_profiles to display doctor names in appointment lists.
CREATE POLICY "user_profiles_staff_read"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
       WHERE up.user_id = auth.uid()
         AND up.role IN ('admin', 'doctor')
    )
  );
