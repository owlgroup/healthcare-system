-- Provider portal "Bệnh nhân" module (distinct from admin Hồ sơ bệnh nhân / VIEW_PATIENT)

INSERT INTO public.permissions (slug, name, category) VALUES
  ('VIEW_PROVIDER_PATIENTS', 'Xem Bệnh nhân (module BS)', 'provider'),
  ('EDIT_PROVIDER_PATIENTS', 'Sửa Bệnh nhân (module BS)', 'provider')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.permissions
SET name = 'Xem hồ sơ bệnh nhân (Admin)'
WHERE slug = 'VIEW_PATIENT';

UPDATE public.permissions
SET name = 'Sửa hồ sơ bệnh nhân (Admin)'
WHERE slug = 'EDIT_PATIENT';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
  AND p.slug IN ('VIEW_PROVIDER_PATIENTS', 'EDIT_PROVIDER_PATIENTS')
ON CONFLICT DO NOTHING;

-- Doctor system role: module BS is default in provider portal
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'doctor'
  AND p.slug IN ('VIEW_PROVIDER_PATIENTS', 'EDIT_PROVIDER_PATIENTS')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_can_view_provider_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission('VIEW_PROVIDER_PATIENTS', 'EDIT_PROVIDER_PATIENTS')
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'doctor')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_provider_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_permission('EDIT_PROVIDER_PATIENTS')
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'doctor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_provider_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_provider_patients() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_patients()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_view_all_patients()
      OR public.user_can_view_provider_patients();
$$;

-- Patient rows for provider module (all patients, same as doctor portal)
CREATE POLICY "patient_provider_module_read" ON public.patient
  FOR SELECT TO authenticated
  USING (public.user_can_view_provider_patients());

CREATE POLICY "patient_provider_module_write" ON public.patient
  FOR ALL TO authenticated
  USING (public.user_can_edit_provider_patients())
  WITH CHECK (public.user_can_edit_provider_patients());

CREATE POLICY "vital_signs_provider_module_read" ON public.vital_signs
  FOR SELECT TO authenticated
  USING (public.user_can_view_provider_patients());

CREATE POLICY "vital_signs_provider_module_write" ON public.vital_signs
  FOR ALL TO authenticated
  USING (public.user_can_edit_provider_patients())
  WITH CHECK (public.user_can_edit_provider_patients());

CREATE OR REPLACE FUNCTION public.update_vital_signs(
  p_id              UUID,
  p_bp_systolic     NUMERIC DEFAULT NULL,
  p_bp_diastolic    NUMERIC DEFAULT NULL,
  p_heart_rate      NUMERIC DEFAULT NULL,
  p_temperature_c   NUMERIC DEFAULT NULL,
  p_respiratory_rate NUMERIC DEFAULT NULL,
  p_spo2            NUMERIC DEFAULT NULL,
  p_weight_kg       NUMERIC DEFAULT NULL,
  p_height_cm       NUMERIC DEFAULT NULL,
  p_clinical_note   TEXT    DEFAULT NULL
)
RETURNS TABLE (id UUID, is_critical BOOLEAN, critical_flags TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bmi            NUMERIC;
  v_is_critical    BOOLEAN := FALSE;
  v_critical_flags TEXT[]  := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.user_can_edit_provider_patients()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles
       WHERE user_id = auth.uid() AND role IN ('admin', 'doctor', 'nurse')
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF p_weight_kg IS NOT NULL AND p_weight_kg > 0
     AND p_height_cm IS NOT NULL AND p_height_cm > 0 THEN
    v_bmi := ROUND((p_weight_kg / POWER(p_height_cm / 100.0, 2))::NUMERIC, 1);
  END IF;

  IF p_bp_systolic IS NOT NULL AND p_bp_systolic > 200 THEN
    v_is_critical    := TRUE;
    v_critical_flags := array_append(v_critical_flags, 'BP_HIGH');
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate < 40 THEN
    v_is_critical    := TRUE;
    v_critical_flags := array_append(v_critical_flags, 'HR_LOW');
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate > 150 THEN
    v_is_critical    := TRUE;
    v_critical_flags := array_append(v_critical_flags, 'HR_HIGH');
  END IF;

  UPDATE public.vital_signs SET
    bp_systolic      = p_bp_systolic,
    bp_diastolic     = p_bp_diastolic,
    heart_rate       = p_heart_rate,
    temperature_c    = p_temperature_c,
    respiratory_rate = p_respiratory_rate,
    spo2             = p_spo2,
    weight_kg        = p_weight_kg,
    height_cm        = p_height_cm,
    bmi              = v_bmi,
    is_critical      = v_is_critical,
    critical_flags   = v_critical_flags,
    clinical_note    = p_clinical_note
  WHERE vital_signs.id = p_id;

  RETURN QUERY SELECT p_id, v_is_critical, v_critical_flags;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vital_signs TO authenticated;
