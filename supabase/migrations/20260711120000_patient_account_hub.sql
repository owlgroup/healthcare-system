-- Patient account hub: emergency contacts, accessibility, sexual health, settings, self vitals

-- ─── Emergency contacts ───────────────────────────────────────────────────────

CREATE TABLE public.patient_emergency_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  relationship     TEXT NOT NULL DEFAULT '',
  phone_number     TEXT NOT NULL DEFAULT '',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_emergency_contacts_user_idx
  ON public.patient_emergency_contacts (patient_user_id, sort_order);

ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_emergency_contacts_own_all" ON public.patient_emergency_contacts
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "patient_emergency_contacts_staff_read" ON public.patient_emergency_contacts
  FOR SELECT
  USING (public.staff_can_access_patients());

-- Migrate legacy inline emergency contact from chart
INSERT INTO public.patient_emergency_contacts (patient_user_id, full_name, relationship, phone_number, sort_order)
SELECT
  c.patient_user_id,
  c.emergency_contact_name,
  'Liên hệ khẩn cấp',
  c.emergency_contact_phone,
  0
FROM public.patient_medical_charts c
WHERE c.emergency_contact_name IS NOT NULL
  AND trim(c.emergency_contact_name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_emergency_contacts ec
    WHERE ec.patient_user_id = c.patient_user_id
  );

-- ─── Accessibility preferences ────────────────────────────────────────────────

CREATE TABLE public.patient_accessibility_preferences (
  patient_user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  communication_language TEXT,
  interpreter_needed   TEXT,
  mobility_support       TEXT,
  additional_notes       TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_accessibility_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_accessibility_own_all" ON public.patient_accessibility_preferences
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "patient_accessibility_staff_read" ON public.patient_accessibility_preferences
  FOR SELECT
  USING (public.staff_can_access_patients());

-- ─── Sexual health (patient-only by default) ───────────────────────────────────

CREATE TABLE public.patient_sexual_health (
  patient_user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sexual_orientation    TEXT,
  sex_at_birth          TEXT,
  prep_pep_status       TEXT,
  last_std_test_date    DATE,
  last_std_test_result  TEXT,
  notes_for_doctor      TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_sexual_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_sexual_health_own_all" ON public.patient_sexual_health
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "patient_sexual_health_doctor_read" ON public.patient_sexual_health
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'doctor'
    )
  );

-- ─── Account settings ─────────────────────────────────────────────────────────

CREATE TABLE public.patient_account_settings (
  patient_user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_reminders      BOOLEAN NOT NULL DEFAULT true,
  test_result_notifications  BOOLEAN NOT NULL DEFAULT true,
  password_updated_at        TIMESTAMPTZ,
  mfa_enabled                BOOLEAN NOT NULL DEFAULT false,
  mfa_phone                  TEXT,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_account_settings_own_all" ON public.patient_account_settings
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

-- ─── Self-reported vitals ─────────────────────────────────────────────────────

CREATE TABLE public.patient_self_vitals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bp_systolic      INTEGER,
  bp_diastolic     INTEGER,
  weight_kg        NUMERIC(6,2),
  height_cm        NUMERIC(6,2),
  temperature_c    NUMERIC(5,2),
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source           TEXT NOT NULL DEFAULT 'self'
);

CREATE INDEX patient_self_vitals_user_idx
  ON public.patient_self_vitals (patient_user_id, recorded_at DESC);

ALTER TABLE public.patient_self_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_self_vitals_own_all" ON public.patient_self_vitals
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "patient_self_vitals_staff_read" ON public.patient_self_vitals
  FOR SELECT
  USING (public.staff_can_access_patients());

-- ─── Patient read access to staff-recorded vitals ─────────────────────────────

CREATE POLICY "vital_signs_patient_read" ON public.vital_signs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = vital_signs.appointment_id
        AND a.patient_id = auth.uid()
    )
  );

-- ─── RPC: care team from latest appointment ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_care_team()
RETURNS TABLE (
  doctor_id UUID,
  doctor_name TEXT,
  specialty TEXT,
  facility_name TEXT,
  last_appointment_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.user_id AS doctor_id,
    COALESCE(up.full_name, up.email, 'Bác sĩ') AS doctor_name,
    up.specialty,
    NULL::TEXT AS facility_name,
    MAX(a.created_at) AS last_appointment_at
  FROM public.appointments a
  JOIN public.appointment_slots s ON s.id = a.slot_id
  JOIN public.user_profiles up ON up.user_id = s.doctor_id
  WHERE a.patient_id = auth.uid()
    AND s.doctor_id IS NOT NULL
  GROUP BY up.user_id, up.full_name, up.email, up.specialty
  ORDER BY last_appointment_at DESC
  LIMIT 3;
$$;

REVOKE ALL ON FUNCTION public.get_my_care_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_care_team() TO authenticated;

-- ─── RPC: accessibility upsert ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_my_accessibility_preferences(
  p_communication_language TEXT DEFAULT NULL,
  p_interpreter_needed TEXT DEFAULT NULL,
  p_mobility_support TEXT DEFAULT NULL,
  p_additional_notes TEXT DEFAULT NULL
)
RETURNS public.patient_accessibility_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.patient_accessibility_preferences;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.patient_accessibility_preferences (
    patient_user_id, communication_language, interpreter_needed, mobility_support, additional_notes, updated_at
  ) VALUES (
    v_uid, p_communication_language, p_interpreter_needed, p_mobility_support, p_additional_notes, now()
  )
  ON CONFLICT (patient_user_id) DO UPDATE SET
    communication_language = EXCLUDED.communication_language,
    interpreter_needed = EXCLUDED.interpreter_needed,
    mobility_support = EXCLUDED.mobility_support,
    additional_notes = EXCLUDED.additional_notes,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_accessibility_preferences(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_accessibility_preferences(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── RPC: sexual health upsert ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_my_sexual_health(
  p_sexual_orientation TEXT DEFAULT NULL,
  p_sex_at_birth TEXT DEFAULT NULL,
  p_prep_pep_status TEXT DEFAULT NULL,
  p_last_std_test_date DATE DEFAULT NULL,
  p_last_std_test_result TEXT DEFAULT NULL,
  p_notes_for_doctor TEXT DEFAULT NULL
)
RETURNS public.patient_sexual_health
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.patient_sexual_health;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.patient_sexual_health (
    patient_user_id, sexual_orientation, sex_at_birth, prep_pep_status,
    last_std_test_date, last_std_test_result, notes_for_doctor, updated_at
  ) VALUES (
    v_uid, p_sexual_orientation, p_sex_at_birth, p_prep_pep_status,
    p_last_std_test_date, p_last_std_test_result, p_notes_for_doctor, now()
  )
  ON CONFLICT (patient_user_id) DO UPDATE SET
    sexual_orientation = EXCLUDED.sexual_orientation,
    sex_at_birth = EXCLUDED.sex_at_birth,
    prep_pep_status = EXCLUDED.prep_pep_status,
    last_std_test_date = EXCLUDED.last_std_test_date,
    last_std_test_result = EXCLUDED.last_std_test_result,
    notes_for_doctor = EXCLUDED.notes_for_doctor,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_sexual_health(TEXT, TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_sexual_health(TEXT, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;

-- ─── RPC: account settings upsert ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_my_account_settings(
  p_appointment_reminders BOOLEAN DEFAULT NULL,
  p_test_result_notifications BOOLEAN DEFAULT NULL,
  p_mfa_enabled BOOLEAN DEFAULT NULL,
  p_mfa_phone TEXT DEFAULT NULL
)
RETURNS public.patient_account_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.patient_account_settings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.patient_account_settings (patient_user_id)
  VALUES (v_uid)
  ON CONFLICT (patient_user_id) DO NOTHING;

  UPDATE public.patient_account_settings SET
    appointment_reminders = COALESCE(p_appointment_reminders, appointment_reminders),
    test_result_notifications = COALESCE(p_test_result_notifications, test_result_notifications),
    mfa_enabled = COALESCE(p_mfa_enabled, mfa_enabled),
    mfa_phone = COALESCE(p_mfa_phone, mfa_phone),
    updated_at = now()
  WHERE patient_user_id = v_uid
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_account_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_account_settings(BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

-- ─── RPC: vitals summary for patient portal ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_vitals_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_staff RECORD;
  v_self RECORD;
  v_chart RECORD;
  v_bp_sys INTEGER;
  v_bp_dia INTEGER;
  v_bp_at TIMESTAMPTZ;
  v_bp_src TEXT;
  v_weight NUMERIC;
  v_weight_at TIMESTAMPTZ;
  v_weight_src TEXT;
  v_height NUMERIC;
  v_height_src TEXT;
  v_temp NUMERIC;
  v_temp_at TIMESTAMPTZ;
  v_temp_src TEXT;
  v_bmi NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT vs.bp_systolic, vs.bp_diastolic, vs.weight_kg, vs.height_cm, vs.temperature_c, vs.recorded_at
  INTO v_staff
  FROM public.vital_signs vs
  JOIN public.appointments a ON a.id = vs.appointment_id
  WHERE a.patient_id = v_uid
  ORDER BY vs.recorded_at DESC
  LIMIT 1;

  SELECT sv.bp_systolic, sv.bp_diastolic, sv.weight_kg, sv.height_cm, sv.temperature_c, sv.recorded_at
  INTO v_self
  FROM public.patient_self_vitals sv
  WHERE sv.patient_user_id = v_uid
  ORDER BY sv.recorded_at DESC
  LIMIT 1;

  SELECT c.blood_pressure_systolic, c.blood_pressure_diastolic, c.weight_kg, c.height_cm, c.temperature_f, c.updated_at
  INTO v_chart
  FROM public.patient_medical_charts c
  WHERE c.patient_user_id = v_uid;

  -- Blood pressure: prefer newest staff, then self, then chart
  IF v_staff.bp_systolic IS NOT NULL THEN
    v_bp_sys := v_staff.bp_systolic; v_bp_dia := v_staff.bp_diastolic; v_bp_at := v_staff.recorded_at; v_bp_src := 'clinical';
  ELSIF v_self.bp_systolic IS NOT NULL THEN
    v_bp_sys := v_self.bp_systolic; v_bp_dia := v_self.bp_diastolic; v_bp_at := v_self.recorded_at; v_bp_src := 'self';
  ELSIF v_chart.blood_pressure_systolic IS NOT NULL THEN
    v_bp_sys := v_chart.blood_pressure_systolic; v_bp_dia := v_chart.blood_pressure_diastolic; v_bp_at := v_chart.updated_at; v_bp_src := 'chart';
  END IF;

  -- Weight
  IF v_staff.weight_kg IS NOT NULL THEN
    v_weight := v_staff.weight_kg; v_weight_at := v_staff.recorded_at; v_weight_src := 'clinical';
  ELSIF v_self.weight_kg IS NOT NULL THEN
    v_weight := v_self.weight_kg; v_weight_at := v_self.recorded_at; v_weight_src := 'self';
  ELSIF v_chart.weight_kg IS NOT NULL THEN
    v_weight := v_chart.weight_kg; v_weight_at := v_chart.updated_at; v_weight_src := 'chart';
  END IF;

  -- Height
  IF v_staff.height_cm IS NOT NULL THEN
    v_height := v_staff.height_cm; v_height_src := 'clinical';
  ELSIF v_self.height_cm IS NOT NULL THEN
    v_height := v_self.height_cm; v_height_src := 'self';
  ELSIF v_chart.height_cm IS NOT NULL THEN
    v_height := v_chart.height_cm; v_height_src := 'chart';
  END IF;

  -- Temperature (chart stores Fahrenheit — convert if used)
  IF v_staff.temperature_c IS NOT NULL THEN
    v_temp := v_staff.temperature_c; v_temp_at := v_staff.recorded_at; v_temp_src := 'clinical';
  ELSIF v_self.temperature_c IS NOT NULL THEN
    v_temp := v_self.temperature_c; v_temp_at := v_self.recorded_at; v_temp_src := 'self';
  ELSIF v_chart.temperature_f IS NOT NULL THEN
    v_temp := ROUND(((v_chart.temperature_f - 32) * 5 / 9)::NUMERIC, 1);
    v_temp_at := v_chart.updated_at; v_temp_src := 'chart';
  END IF;

  IF v_weight IS NOT NULL AND v_height IS NOT NULL AND v_height > 0 THEN
    v_bmi := ROUND((v_weight / POWER(v_height / 100.0, 2))::NUMERIC, 1);
  END IF;

  RETURN jsonb_build_object(
    'blood_pressure', jsonb_build_object(
      'systolic', v_bp_sys, 'diastolic', v_bp_dia,
      'recorded_at', v_bp_at, 'source', v_bp_src
    ),
    'weight', jsonb_build_object(
      'kg', v_weight, 'recorded_at', v_weight_at, 'source', v_weight_src
    ),
    'height', jsonb_build_object(
      'cm', v_height, 'bmi', v_bmi, 'source', v_height_src
    ),
    'temperature', jsonb_build_object(
      'celsius', v_temp, 'recorded_at', v_temp_at, 'source', v_temp_src
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_vitals_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_vitals_summary() TO authenticated;

-- API grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_accessibility_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_sexual_health TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_account_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_self_vitals TO authenticated;
