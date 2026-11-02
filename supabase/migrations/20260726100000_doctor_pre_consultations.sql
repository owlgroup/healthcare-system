-- Doctor pre-consultation layer (FR-022 extension)
-- Separate editable record for doctors; patient pre_consultations stays immutable after SUBMITTED.

ALTER TABLE public.pre_consultations
  ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES auth.users(id);

UPDATE public.pre_consultations
SET submitted_by_user_id = patient_id
WHERE status = 'SUBMITTED' AND submitted_by_user_id IS NULL;

CREATE TABLE public.doctor_pre_consultations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id        UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  chief_complaint       TEXT,
  symptom_duration      INTEGER,
  symptom_duration_unit TEXT,
  pain_scale            INTEGER CHECK (pain_scale IS NULL OR (pain_scale >= 0 AND pain_scale <= 10)),
  symptom_tags          TEXT[],

  medical_history       JSONB DEFAULT '[]'::jsonb,
  surgical_history      TEXT,
  family_history        JSONB DEFAULT '[]'::jsonb,

  current_medications   JSONB DEFAULT '[]'::jsonb,
  otc_supplements       TEXT,

  drug_allergies        JSONB DEFAULT '[]'::jsonb,
  food_allergies        JSONB DEFAULT '[]'::jsonb,

  smoking               TEXT,
  smoking_frequency     TEXT,
  alcohol               TEXT,
  alcohol_frequency     TEXT,
  exercise              TEXT,
  exercise_frequency    TEXT,

  flags                 JSONB DEFAULT '{}'::jsonb,

  created_by_user_id    UUID NOT NULL REFERENCES auth.users(id),
  updated_by_user_id    UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.doctor_pre_consultations IS
  'Doctor-authored pre-consultation declarations. Separate from immutable patient pre_consultations.';

CREATE INDEX doctor_pre_consult_appointment_idx ON public.doctor_pre_consultations (appointment_id);
CREATE INDEX doctor_pre_consult_patient_idx ON public.doctor_pre_consultations (patient_id);

CREATE TRIGGER doctor_pre_consultations_set_updated_at
  BEFORE UPDATE ON public.doctor_pre_consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.doctor_pre_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_pre_consult_doctor_all" ON public.doctor_pre_consultations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

CREATE POLICY "doctor_pre_consult_staff_select" ON public.doctor_pre_consultations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

CREATE POLICY "doctor_pre_consult_permission_read" ON public.doctor_pre_consultations
  FOR SELECT TO authenticated
  USING (public.user_can_view_all_appointments());

CREATE OR REPLACE FUNCTION public.compute_pre_consult_flags(
  p_pain_scale     INTEGER,
  p_drug_allergies JSONB
) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'drug_allergy', (p_drug_allergies IS NOT NULL AND jsonb_typeof(p_drug_allergies) = 'array' AND jsonb_array_length(p_drug_allergies) > 0),
    'severe_pain', (p_pain_scale IS NOT NULL AND p_pain_scale >= 7)
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_appointment_allows_doctor_pre_consult(
  p_appointment_id UUID
) RETURNS TABLE (patient_id UUID, appt_status public.appointment_status)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_patient_id UUID;
  v_status     public.appointment_status;
BEGIN
  SELECT a.patient_id, a.status
  INTO v_patient_id, v_status
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW') THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT_STATUS: Cannot modify pre-consultation for closed appointment' USING errcode = 'P0003';
  END IF;

  RETURN QUERY SELECT v_patient_id, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_get_doctor_pre_consultation(
  p_appointment_id UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_patient_id  UUID;
  v_existing_id UUID;
  v_new_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = v_user_id AND role IN ('doctor', 'admin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT patient_id INTO v_patient_id
  FROM public.assert_appointment_allows_doctor_pre_consult(p_appointment_id);

  SELECT id INTO v_existing_id
  FROM public.doctor_pre_consultations
  WHERE appointment_id = p_appointment_id;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.doctor_pre_consultations (
    appointment_id, patient_id, created_by_user_id, updated_by_user_id
  ) VALUES (
    p_appointment_id, v_patient_id, v_user_id, v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_doctor_pre_consultation(
  p_id                    UUID,
  p_chief_complaint       TEXT      DEFAULT NULL,
  p_symptom_duration      INTEGER   DEFAULT NULL,
  p_symptom_duration_unit TEXT      DEFAULT NULL,
  p_pain_scale            INTEGER   DEFAULT NULL,
  p_symptom_tags          TEXT[]    DEFAULT NULL,
  p_medical_history       JSONB     DEFAULT NULL,
  p_surgical_history      TEXT      DEFAULT NULL,
  p_family_history        JSONB     DEFAULT NULL,
  p_current_medications   JSONB     DEFAULT NULL,
  p_otc_supplements       TEXT      DEFAULT NULL,
  p_drug_allergies        JSONB     DEFAULT NULL,
  p_food_allergies        JSONB     DEFAULT NULL,
  p_smoking               TEXT      DEFAULT NULL,
  p_smoking_frequency     TEXT      DEFAULT NULL,
  p_alcohol               TEXT      DEFAULT NULL,
  p_alcohol_frequency     TEXT      DEFAULT NULL,
  p_exercise              TEXT      DEFAULT NULL,
  p_exercise_frequency    TEXT      DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_flags     JSONB;
  v_pain      INTEGER;
  v_allergies JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = v_user_id AND role IN ('doctor', 'admin')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.doctor_pre_consultations dpc
    JOIN public.appointments a ON a.id = dpc.appointment_id
    WHERE dpc.id = p_id
      AND a.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW')
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  UPDATE public.doctor_pre_consultations SET
    chief_complaint       = COALESCE(p_chief_complaint, chief_complaint),
    symptom_duration      = COALESCE(p_symptom_duration, symptom_duration),
    symptom_duration_unit = COALESCE(p_symptom_duration_unit, symptom_duration_unit),
    pain_scale            = COALESCE(p_pain_scale, pain_scale),
    symptom_tags          = COALESCE(p_symptom_tags, symptom_tags),
    medical_history       = COALESCE(p_medical_history, medical_history),
    surgical_history      = COALESCE(p_surgical_history, surgical_history),
    family_history        = COALESCE(p_family_history, family_history),
    current_medications   = COALESCE(p_current_medications, current_medications),
    otc_supplements       = COALESCE(p_otc_supplements, otc_supplements),
    drug_allergies        = COALESCE(p_drug_allergies, drug_allergies),
    food_allergies        = COALESCE(p_food_allergies, food_allergies),
    smoking               = COALESCE(p_smoking, smoking),
    smoking_frequency     = COALESCE(p_smoking_frequency, smoking_frequency),
    alcohol               = COALESCE(p_alcohol, alcohol),
    alcohol_frequency     = COALESCE(p_alcohol_frequency, alcohol_frequency),
    exercise              = COALESCE(p_exercise, exercise),
    exercise_frequency    = COALESCE(p_exercise_frequency, exercise_frequency),
    updated_by_user_id    = v_user_id
  WHERE id = p_id
  RETURNING pain_scale, drug_allergies INTO v_pain, v_allergies;

  v_flags := public.compute_pre_consult_flags(v_pain, v_allergies);
  UPDATE public.doctor_pre_consultations SET flags = v_flags WHERE id = p_id;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pre_consultation_bundle(
  p_appointment_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role    TEXT;
  v_result  JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_user_id;

  IF v_role = 'patient' OR v_role IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = p_appointment_id AND a.patient_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'patient', (
      SELECT to_jsonb(pc.*)
      FROM public.pre_consultations pc
      WHERE pc.appointment_id = p_appointment_id
    ),
    'doctor', (
      SELECT to_jsonb(dpc.*)
      FROM public.doctor_pre_consultations dpc
      WHERE dpc.appointment_id = p_appointment_id
    ),
    'patient_creator_name', (
      SELECT COALESCE(up.full_name, up.email, 'Bệnh nhân')
      FROM public.pre_consultations pc
      LEFT JOIN public.user_profiles up ON up.user_id = COALESCE(pc.submitted_by_user_id, pc.patient_id)
      WHERE pc.appointment_id = p_appointment_id
    ),
    'doctor_creator_name', (
      SELECT COALESCE(up.full_name, up.email, 'Bác sĩ')
      FROM public.doctor_pre_consultations dpc
      LEFT JOIN public.user_profiles up ON up.user_id = dpc.created_by_user_id
      WHERE dpc.appointment_id = p_appointment_id
    ),
    'doctor_updater_name', (
      SELECT COALESCE(up.full_name, up.email, 'Bác sĩ')
      FROM public.doctor_pre_consultations dpc
      LEFT JOIN public.user_profiles up ON up.user_id = dpc.updated_by_user_id
      WHERE dpc.appointment_id = p_appointment_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_pre_consultation(
  p_id UUID
) RETURNS TABLE (
  id    UUID,
  flags JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id           UUID;
  v_status            public.pre_consultation_status;
  v_patient_id        UUID;
  v_chief_complaint   TEXT;
  v_symptom_duration  INTEGER;
  v_pain_scale        INTEGER;
  v_drug_allergies    JSONB;
  v_computed_flags    JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT
    pc.status, pc.patient_id, pc.chief_complaint, pc.symptom_duration,
    pc.pain_scale, pc.drug_allergies
  INTO v_status, v_patient_id, v_chief_complaint, v_symptom_duration, v_pain_scale, v_drug_allergies
  FROM public.pre_consultations pc
  WHERE pc.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_patient_id != v_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED' USING errcode = 'P0004';
  END IF;

  IF v_chief_complaint IS NULL OR v_chief_complaint = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: chief_complaint is required' USING errcode = 'P0010';
  END IF;

  IF v_symptom_duration IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: symptom_duration is required' USING errcode = 'P0011';
  END IF;

  v_computed_flags := public.compute_pre_consult_flags(v_pain_scale, v_drug_allergies);

  UPDATE public.pre_consultations SET
    status               = 'SUBMITTED',
    flags                = v_computed_flags,
    submitted_at         = now(),
    submitted_by_user_id = v_user_id
  WHERE pre_consultations.id = p_id;

  RETURN QUERY SELECT p_id, v_computed_flags;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_doctor_pre_consultation TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_doctor_pre_consultation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pre_consultation_bundle TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_pre_consultations;
ALTER TABLE public.doctor_pre_consultations REPLICA IDENTITY FULL;
