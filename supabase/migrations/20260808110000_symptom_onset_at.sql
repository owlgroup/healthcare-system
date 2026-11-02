-- Add symptom_onset_at column to store exact onset date/time
-- This replaces the need to calculate from symptom_duration

-- Add column to pre_consultations
ALTER TABLE public.pre_consultations
ADD COLUMN IF NOT EXISTS symptom_onset_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pre_consultations.symptom_onset_at IS
  'Exact date/time when symptoms started (replaces duration calculation)';

-- Add column to doctor_pre_consultations
ALTER TABLE public.doctor_pre_consultations
ADD COLUMN IF NOT EXISTS symptom_onset_at TIMESTAMPTZ;

COMMENT ON COLUMN public.doctor_pre_consultations.symptom_onset_at IS
  'Exact date/time when symptoms started (replaces duration calculation)';

-- Update RPC: update_pre_consultation to accept symptom_onset_at
CREATE OR REPLACE FUNCTION public.update_pre_consultation(
  p_id                    UUID,
  p_chief_complaint       TEXT      DEFAULT NULL,
  p_symptom_duration      INTEGER   DEFAULT NULL,
  p_symptom_duration_unit TEXT      DEFAULT NULL,
  p_symptom_onset_at      TIMESTAMPTZ DEFAULT NULL,
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
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id     UUID;
  v_status      public.pre_consultation_status;
  v_patient_id  UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT status, patient_id INTO v_status, v_patient_id
  FROM public.pre_consultations
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_patient_id != v_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED: Cannot modify submitted pre-consultation' USING errcode = 'P0004';
  END IF;

  UPDATE public.pre_consultations SET
    chief_complaint       = COALESCE(p_chief_complaint, chief_complaint),
    symptom_duration      = COALESCE(p_symptom_duration, symptom_duration),
    symptom_duration_unit = COALESCE(p_symptom_duration_unit, symptom_duration_unit),
    symptom_onset_at      = COALESCE(p_symptom_onset_at, symptom_onset_at),
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
    exercise_frequency    = COALESCE(p_exercise_frequency, exercise_frequency)
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

-- Update RPC: update_doctor_pre_consultation to accept symptom_onset_at
CREATE OR REPLACE FUNCTION public.update_doctor_pre_consultation(
  p_id                    UUID,
  p_chief_complaint       TEXT      DEFAULT NULL,
  p_symptom_duration      INTEGER   DEFAULT NULL,
  p_symptom_duration_unit TEXT      DEFAULT NULL,
  p_symptom_onset_at      TIMESTAMPTZ DEFAULT NULL,
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
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_role    TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_user_id;
  IF v_role NOT IN ('doctor', 'admin', 'staff') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctor_pre_consultations WHERE id = p_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  UPDATE public.doctor_pre_consultations SET
    chief_complaint       = COALESCE(p_chief_complaint, chief_complaint),
    symptom_duration      = COALESCE(p_symptom_duration, symptom_duration),
    symptom_duration_unit = COALESCE(p_symptom_duration_unit, symptom_duration_unit),
    symptom_onset_at      = COALESCE(p_symptom_onset_at, symptom_onset_at),
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
  WHERE id = p_id;

  RETURN p_id;
END;
$$;
