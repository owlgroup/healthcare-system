-- Fix: bác sĩ/admin không đọc được public.patient vì policy cũ JOIN user_profiles
-- (bảng user_profiles chỉ cho service_role). Dùng JWT user_role + RPC SECURITY DEFINER.

DROP POLICY IF EXISTS patient_select_doctor ON public.patient;
DROP POLICY IF EXISTS patient_select_admin ON public.patient;

CREATE POLICY patient_select_staff_jwt
  ON public.patient
  FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt () ->> 'user_role', '') IN ('doctor', 'admin')
  );

-- Cho phép user đọc profile của chính mình (hỗ trợ policy / UI khác)
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid () = user_id);

CREATE OR REPLACE FUNCTION public.staff_can_access_patients ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid ()
      AND up.role IN ('doctor', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.staff_can_access_patients () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_can_access_patients () TO authenticated;

CREATE OR REPLACE FUNCTION public.list_patients_for_staff ()
RETURNS SETOF public.patient
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.patient p
  WHERE public.staff_can_access_patients ()
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_patients_for_staff () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_patients_for_staff () TO authenticated;

CREATE OR REPLACE FUNCTION public.get_patient_for_staff (p_patient_id uuid)
RETURNS public.patient
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.patient p
  WHERE p.id = p_patient_id
    AND public.staff_can_access_patients ()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_patient_for_staff (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_for_staff (uuid) TO authenticated;
