-- Drop the recursive policy and replace with one using
-- the existing staff_can_access_patients() security-definer function
-- which queries user_profiles WITHOUT triggering RLS (runs as function owner).

DROP POLICY IF EXISTS "user_profiles_staff_read" ON public.user_profiles;

CREATE POLICY "user_profiles_staff_read"
  ON public.user_profiles FOR SELECT
  USING (public.staff_can_access_patients());
