-- FR-022: Pre-Consultation Health Declaration
-- Table: pre_consultations
-- APIs: create, update (auto-save), submit
-- Flags: drug_allergy, severe_pain for EMR highlighting

-- ─── Pre-Consultation Status ─────────────────────────────────────────────────

CREATE TYPE public.pre_consultation_status AS ENUM (
  'DRAFT',      -- Patient is filling in the form (auto-save)
  'SUBMITTED'   -- Patient has completed and submitted (immutable)
);

-- ─── Pre-Consultation Table ──────────────────────────────────────────────────

CREATE TABLE public.pre_consultations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            public.pre_consultation_status NOT NULL DEFAULT 'DRAFT',

  -- ═══ Nhóm 1: Triệu chứng hiện tại (Current Symptoms) ═══
  chief_complaint       TEXT,                    -- Lý do đến khám (required for submit)
  symptom_duration      INTEGER,                 -- Số lượng (e.g., 3)
  symptom_duration_unit TEXT,                    -- Đơn vị: 'days' | 'weeks' | 'months'
  pain_scale            INTEGER CHECK (pain_scale IS NULL OR (pain_scale >= 0 AND pain_scale <= 10)),
  symptom_tags          TEXT[],                  -- Multi-select: ['fever', 'cough', 'shortness_of_breath', ...]

  -- ═══ Nhóm 2: Bệnh sử (Medical History) ═══
  medical_history       JSONB DEFAULT '[]'::jsonb,
    -- Array of { condition: string, details?: string }
    -- e.g., [{"condition": "diabetes", "details": "Type 2, 5 years"}, {"condition": "hypertension"}]
  surgical_history      TEXT,
  family_history        JSONB DEFAULT '[]'::jsonb,
    -- Array of { condition: string, relation?: string }
    -- e.g., [{"condition": "heart_disease", "relation": "father"}]

  -- ═══ Nhóm 3: Thuốc đang dùng (Current Medications) ═══
  current_medications   JSONB DEFAULT '[]'::jsonb,
    -- Array of { name: string, dose: string, frequency: string }
    -- e.g., [{"name": "Amlodipine", "dose": "5mg", "frequency": "1v/ngày"}]
  otc_supplements       TEXT,    -- Over-the-counter drugs and supplements

  -- ═══ Nhóm 4: Dị ứng (Allergies) ═══
  drug_allergies        JSONB DEFAULT '[]'::jsonb,
    -- Array of { drug: string, reaction: string }
    -- e.g., [{"drug": "Penicillin", "reaction": "Sốc phản vệ"}]
  food_allergies        JSONB DEFAULT '[]'::jsonb,
    -- Array of { food: string, reaction: string }

  -- ═══ Nhóm 5: Lối sống (Lifestyle) ═══
  smoking               TEXT,    -- 'never' | 'former' | 'current'
  smoking_frequency     TEXT,    -- e.g., '10 điếu/ngày' (only if smoking = 'current')
  alcohol               TEXT,    -- 'never' | 'occasionally' | 'regularly'
  alcohol_frequency     TEXT,    -- e.g., '2-3 lần/tuần'
  exercise              TEXT,    -- 'never' | 'occasionally' | 'regularly'
  exercise_frequency    TEXT,    -- e.g., '30 phút/ngày'

  -- ═══ Computed Flags (RULE-022d, RULE-022e) ═══
  flags                 JSONB DEFAULT '{}'::jsonb,
    -- { drug_allergy: boolean, severe_pain: boolean }
    -- Computed on submit based on drug_allergies and pain_scale

  -- ═══ Metadata ═══
  submitted_at          TIMESTAMPTZ,             -- When form was submitted (null = draft)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pre_consultations IS
  'Pre-consultation health declarations (FR-022). Patients fill before appointment. Immutable after SUBMITTED (RULE-022c).';

COMMENT ON COLUMN public.pre_consultations.flags IS
  'Computed warning flags: drug_allergy (RULE-022d), severe_pain >= 7 (RULE-022e)';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX pre_consult_patient_idx ON public.pre_consultations (patient_id, status);
CREATE INDEX pre_consult_appointment_idx ON public.pre_consultations (appointment_id);
CREATE INDEX pre_consult_flags_idx ON public.pre_consultations USING GIN (flags) WHERE status = 'SUBMITTED';

-- ─── Updated At Trigger ──────────────────────────────────────────────────────

CREATE TRIGGER pre_consultations_set_updated_at
  BEFORE UPDATE ON public.pre_consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pre_consultations ENABLE ROW LEVEL SECURITY;

-- Patients can read and write their own pre-consultations
CREATE POLICY "pre_consult_patient_select" ON public.pre_consultations
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "pre_consult_patient_insert" ON public.pre_consultations
  FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "pre_consult_patient_update" ON public.pre_consultations
  FOR UPDATE
  USING (patient_id = auth.uid() AND status = 'DRAFT')
  WITH CHECK (patient_id = auth.uid() AND status = 'DRAFT');

-- Doctors can read all pre-consultations
CREATE POLICY "pre_consult_doctor_select" ON public.pre_consultations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'doctor'
    )
  );

-- Staff can read all pre-consultations
CREATE POLICY "pre_consult_staff_select" ON public.pre_consultations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'staff'
    )
  );

-- Admin has full access
CREATE POLICY "pre_consult_admin_all" ON public.pre_consultations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── RPC: create_pre_consultation ────────────────────────────────────────────
-- Creates a new draft pre-consultation for an appointment
-- RULE-022a: Only for CONFIRMED appointments, not EMERGENCY

CREATE OR REPLACE FUNCTION public.create_pre_consultation(
  p_appointment_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id       UUID;
  v_appt_status   public.appointment_status;
  v_appt_patient  UUID;
  v_existing_id   UUID;
  v_new_id        UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Check appointment exists and belongs to user
  SELECT status, patient_id INTO v_appt_status, v_appt_patient
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_appt_patient != v_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- RULE-022a: Only CONFIRMED appointments (not EMERGENCY)
  IF v_appt_status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT_STATUS: Only CONFIRMED appointments can have pre-consultation' USING errcode = 'P0003';
  END IF;

  -- Check if pre-consultation already exists
  SELECT id INTO v_existing_id
  FROM public.pre_consultations
  WHERE appointment_id = p_appointment_id;

  IF FOUND THEN
    RETURN v_existing_id;  -- Return existing one (idempotent)
  END IF;

  -- Create new draft
  INSERT INTO public.pre_consultations (appointment_id, patient_id)
  VALUES (p_appointment_id, v_user_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─── RPC: update_pre_consultation ────────────────────────────────────────────
-- Updates draft pre-consultation (auto-save during form fill)
-- RULE-022b: Cannot update after SUBMITTED

CREATE OR REPLACE FUNCTION public.update_pre_consultation(
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

  -- Get current status and verify ownership
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

  -- RULE-022b: Cannot update after SUBMITTED
  IF v_status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED: Cannot modify submitted pre-consultation' USING errcode = 'P0004';
  END IF;

  -- Update all provided fields
  UPDATE public.pre_consultations SET
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
    exercise_frequency    = COALESCE(p_exercise_frequency, exercise_frequency)
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

-- ─── RPC: submit_pre_consultation ────────────────────────────────────────────
-- Finalizes pre-consultation, validates required fields, computes flags
-- RULE-022d: drug_allergies >= 1 → flag
-- RULE-022e: pain_scale >= 7 → flag

CREATE OR REPLACE FUNCTION public.submit_pre_consultation(
  p_id UUID
) RETURNS TABLE (
  id             UUID,
  flags          JSONB
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

  -- Get current data and verify ownership
  SELECT
    pc.status,
    pc.patient_id,
    pc.chief_complaint,
    pc.symptom_duration,
    pc.pain_scale,
    pc.drug_allergies
  INTO
    v_status,
    v_patient_id,
    v_chief_complaint,
    v_symptom_duration,
    v_pain_scale,
    v_drug_allergies
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

  -- Validate required fields
  IF v_chief_complaint IS NULL OR v_chief_complaint = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: chief_complaint is required' USING errcode = 'P0010';
  END IF;

  IF v_symptom_duration IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: symptom_duration is required' USING errcode = 'P0011';
  END IF;

  -- Compute flags (RULE-022d, RULE-022e)
  v_computed_flags := jsonb_build_object(
    'drug_allergy', (v_drug_allergies IS NOT NULL AND jsonb_array_length(v_drug_allergies) > 0),
    'severe_pain', (v_pain_scale IS NOT NULL AND v_pain_scale >= 7)
  );

  -- Update to SUBMITTED with computed flags
  UPDATE public.pre_consultations SET
    status       = 'SUBMITTED',
    flags        = v_computed_flags,
    submitted_at = now()
  WHERE pre_consultations.id = p_id;

  RETURN QUERY SELECT p_id, v_computed_flags;
END;
$$;

-- ─── RPC: get_pre_consultation_by_appointment ────────────────────────────────
-- Gets pre-consultation data for a specific appointment (doctor EMR view)

CREATE OR REPLACE FUNCTION public.get_pre_consultation_by_appointment(
  p_appointment_id UUID
) RETURNS TABLE (
  id                    UUID,
  appointment_id        UUID,
  patient_id            UUID,
  status                public.pre_consultation_status,
  chief_complaint       TEXT,
  symptom_duration      INTEGER,
  symptom_duration_unit TEXT,
  pain_scale            INTEGER,
  symptom_tags          TEXT[],
  medical_history       JSONB,
  surgical_history      TEXT,
  family_history        JSONB,
  current_medications   JSONB,
  otc_supplements       TEXT,
  drug_allergies        JSONB,
  food_allergies        JSONB,
  smoking               TEXT,
  smoking_frequency     TEXT,
  alcohol               TEXT,
  alcohol_frequency     TEXT,
  exercise              TEXT,
  exercise_frequency    TEXT,
  flags                 JSONB,
  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_role      TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Check if user is doctor/staff/admin or the patient themselves
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  -- For patients, verify they own the appointment
  IF v_role = 'patient' OR v_role IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = p_appointment_id AND a.patient_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    pc.id,
    pc.appointment_id,
    pc.patient_id,
    pc.status,
    pc.chief_complaint,
    pc.symptom_duration,
    pc.symptom_duration_unit,
    pc.pain_scale,
    pc.symptom_tags,
    pc.medical_history,
    pc.surgical_history,
    pc.family_history,
    pc.current_medications,
    pc.otc_supplements,
    pc.drug_allergies,
    pc.food_allergies,
    pc.smoking,
    pc.smoking_frequency,
    pc.alcohol,
    pc.alcohol_frequency,
    pc.exercise,
    pc.exercise_frequency,
    pc.flags,
    pc.submitted_at,
    pc.created_at,
    pc.updated_at
  FROM public.pre_consultations pc
  WHERE pc.appointment_id = p_appointment_id;
END;
$$;

-- ─── Realtime (doctor screen updates when patient submits) ───────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_consultations;
ALTER TABLE public.pre_consultations REPLICA IDENTITY FULL;
