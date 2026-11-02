-- Custom roles: module VIEW permission grants system-wide read (all records in that module)

CREATE OR REPLACE FUNCTION public.user_has_any_permission(VARIADIC p_permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(p_permissions) AS req(slug)
    WHERE public.user_has_permission(req.slug)
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_any_permission(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_any_permission(text[]) TO authenticated;

-- ─── Module access helpers (view = all rows in module) ────────────────────────

CREATE OR REPLACE FUNCTION public.user_can_view_all_appointments()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission(
    'VIEW_APPOINTMENT',
    'appointments.read',
    'appointments.write',
    'appointments.cancel'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_appointments()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission('appointments.write', 'appointments.cancel')
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_all_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission('VIEW_PATIENT', 'EDIT_PATIENT')
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'doctor')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission('EDIT_PATIENT')
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'doctor')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_clinical_records()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission(
    'VIEW_SOAP',
    'EDIT_SOAP',
    'SIGN_MEDICAL_RECORD'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'doctor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_all_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_write_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_all_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_clinical_records() TO authenticated;

-- Patient list RPC (used by admin + customer portal)
CREATE OR REPLACE FUNCTION public.staff_can_access_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_view_all_patients();
$$;

-- ─── Appointments: custom role sees ALL appointments ─────────────────────────

CREATE POLICY "appointments_permission_read" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.user_can_view_all_appointments());

CREATE POLICY "appointments_permission_write" ON public.appointments
  FOR ALL TO authenticated
  USING (public.user_can_write_appointments())
  WITH CHECK (public.user_can_write_appointments());

-- ─── Patients: custom role sees ALL patient profiles ───────────────────────

CREATE POLICY "patient_permission_read" ON public.patient
  FOR SELECT TO authenticated
  USING (public.user_can_view_all_patients());

CREATE POLICY "patient_permission_write" ON public.patient
  FOR ALL TO authenticated
  USING (public.user_can_edit_patients())
  WITH CHECK (public.user_can_edit_patients());

-- Doctor names / staff labels in joined lists
CREATE POLICY "user_profiles_module_read" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    public.user_can_view_all_appointments()
    OR public.user_can_view_all_patients()
  );

-- Related appointment data (pre-consult, vitals)
CREATE POLICY "pre_consult_permission_read" ON public.pre_consultations
  FOR SELECT TO authenticated
  USING (public.user_can_view_all_appointments());

CREATE POLICY "vital_signs_permission_read" ON public.vital_signs
  FOR SELECT TO authenticated
  USING (public.user_can_view_all_appointments());

-- ─── Admin appointment RPCs: allow permission holders (not only admin) ───────

CREATE OR REPLACE FUNCTION public.admin_search_patients(p_query text)
RETURNS TABLE (
  profile_id uuid,
  patient_id uuid,
  patient_name text,
  phone_number text,
  id_number text,
  date_of_birth date,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_view_all_patients() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS profile_id,
    p.user_id AS patient_id,
    trim(coalesce(p.legal_last_name, '') || ' ' || coalesce(p.legal_first_name, '')) AS patient_name,
    p.phone_number,
    p.id_number,
    p.date_of_birth,
    p.submitted_at
  FROM public.patient p
  WHERE
    p_query IS NULL
    OR p.phone_number ILIKE '%' || p_query || '%'
    OR p.legal_first_name ILIKE '%' || p_query || '%'
    OR p.legal_last_name ILIKE '%' || p_query || '%'
    OR p.id_number ILIKE '%' || p_query || '%'
  ORDER BY p.submitted_at DESC NULLS LAST
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_patients(text) TO authenticated;
