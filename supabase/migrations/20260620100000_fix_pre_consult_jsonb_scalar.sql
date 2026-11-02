-- Fix FR-022 bug: jsonb columns were double-encoded by the client (JSON.stringify
-- of an already-serialized RPC param), so Postgres stored a JSON *string* scalar
-- (e.g. "[]") instead of a real JSONB array. jsonb_array_length() then fails with
-- "cannot get array length of a scalar" (22023) in submit_pre_consultation.
--
-- 1) Repair any rows already corrupted by the old client code.
-- 2) Make submit_pre_consultation defensive against non-array values going forward.

UPDATE public.pre_consultations
SET drug_allergies = '[]'::jsonb
WHERE jsonb_typeof(drug_allergies) <> 'array';

UPDATE public.pre_consultations
SET food_allergies = '[]'::jsonb
WHERE jsonb_typeof(food_allergies) <> 'array';

UPDATE public.pre_consultations
SET medical_history = '[]'::jsonb
WHERE jsonb_typeof(medical_history) <> 'array';

UPDATE public.pre_consultations
SET family_history = '[]'::jsonb
WHERE jsonb_typeof(family_history) <> 'array';

UPDATE public.pre_consultations
SET current_medications = '[]'::jsonb
WHERE jsonb_typeof(current_medications) <> 'array';

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
  -- Guard against legacy/malformed scalar JSON (only real arrays count).
  v_computed_flags := jsonb_build_object(
    'drug_allergy', (jsonb_typeof(v_drug_allergies) = 'array' AND jsonb_array_length(v_drug_allergies) > 0),
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
