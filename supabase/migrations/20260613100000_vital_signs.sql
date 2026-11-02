-- FR-014: Vital Signs Recording
-- Table: vital_signs
-- RPC: record_vital_signs (validates, computes BMI, flags critical)
-- Realtime: enabled so doctor screen updates live

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.vital_signs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  recorded_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Huyết áp
  bp_systolic      INTEGER,       -- mmHg; warn outside 60–250
  bp_diastolic     INTEGER,       -- mmHg; warn outside 40–150

  -- Sinh hiệu
  heart_rate       INTEGER,       -- bpm; warn outside 30–200
  temperature_c    NUMERIC(5,2),  -- °C; warn outside 34–42
  respiratory_rate INTEGER,       -- lần/phút; warn outside 8–40
  spo2             NUMERIC(5,2),  -- %; warn outside 70–100

  -- Thể trạng
  weight_kg        NUMERIC(6,2),  -- RULE-014a: must be > 0 if provided
  height_cm        NUMERIC(6,2),  -- RULE-014a: must be > 0 if provided
  bmi              NUMERIC(5,2),  -- auto-computed from weight/height

  -- Flags (RULE-014d)
  is_critical      BOOLEAN NOT NULL DEFAULT false,
  critical_flags   TEXT[],        -- e.g. ['bp_systolic > 200', 'heart_rate < 40']

  clinical_note    TEXT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vital_signs IS
  'Per-appointment vital sign records (FR-014). Multiple records per appointment allowed (RULE-014e).';

CREATE INDEX vital_signs_appointment_idx ON public.vital_signs (appointment_id, recorded_at DESC);
CREATE INDEX vital_signs_recorded_by_idx ON public.vital_signs (recorded_by);
CREATE INDEX vital_signs_critical_idx    ON public.vital_signs (is_critical) WHERE is_critical = true;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.vital_signs ENABLE ROW LEVEL SECURITY;

-- Doctors can read vital signs for their patients
CREATE POLICY "vital_signs_doctor_read" ON public.vital_signs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'doctor'
    )
  );

-- Admins can read all
CREATE POLICY "vital_signs_admin_all" ON public.vital_signs
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

-- Doctors can insert
CREATE POLICY "vital_signs_doctor_insert" ON public.vital_signs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'doctor'
    )
  );

-- ─── RPC: record_vital_signs ──────────────────────────────────────────────────
-- Validates, computes BMI, sets critical flags, inserts record.
-- Returns: (id uuid, is_critical boolean, critical_flags text[])

CREATE OR REPLACE FUNCTION public.record_vital_signs(
  p_appointment_id   UUID,
  p_bp_systolic      INTEGER   DEFAULT NULL,
  p_bp_diastolic     INTEGER   DEFAULT NULL,
  p_heart_rate       INTEGER   DEFAULT NULL,
  p_temperature_c    NUMERIC   DEFAULT NULL,
  p_respiratory_rate INTEGER   DEFAULT NULL,
  p_spo2             NUMERIC   DEFAULT NULL,
  p_weight_kg        NUMERIC   DEFAULT NULL,
  p_height_cm        NUMERIC   DEFAULT NULL,
  p_clinical_note    TEXT      DEFAULT NULL
) RETURNS TABLE (
  id             UUID,
  is_critical    BOOLEAN,
  critical_flags TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id       UUID;
  v_appt_status   public.appointment_status;
  v_bmi           NUMERIC(5,2);
  v_critical      BOOLEAN := false;
  v_flags         TEXT[]  := '{}';
  v_record_id     UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Verify appointment exists and caller has access
  SELECT a.status INTO v_appt_status
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- RULE-014a: weight and height must be > 0 if provided
  IF p_weight_kg IS NOT NULL AND p_weight_kg <= 0 THEN
    RAISE EXCEPTION 'INVALID_WEIGHT' USING errcode = 'P0010';
  END IF;
  IF p_height_cm IS NOT NULL AND p_height_cm <= 0 THEN
    RAISE EXCEPTION 'INVALID_HEIGHT' USING errcode = 'P0011';
  END IF;

  -- Auto-compute BMI (RULE-014b implied)
  IF p_weight_kg IS NOT NULL AND p_height_cm IS NOT NULL THEN
    v_bmi := ROUND(p_weight_kg / POWER(p_height_cm / 100.0, 2), 1);
  END IF;

  -- RULE-014d: critical flag detection (AF-2)
  IF p_bp_systolic IS NOT NULL AND p_bp_systolic > 200 THEN
    v_critical := true;
    v_flags    := array_append(v_flags, 'bp_systolic > 200');
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate < 40 THEN
    v_critical := true;
    v_flags    := array_append(v_flags, 'heart_rate < 40');
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate > 150 THEN
    v_critical := true;
    v_flags    := array_append(v_flags, 'heart_rate > 150');
  END IF;

  -- Insert record (RULE-014e: multiple records per appointment allowed)
  INSERT INTO public.vital_signs (
    appointment_id, recorded_by,
    bp_systolic, bp_diastolic,
    heart_rate, temperature_c, respiratory_rate, spo2,
    weight_kg, height_cm, bmi,
    is_critical, critical_flags,
    clinical_note
  ) VALUES (
    p_appointment_id, v_user_id,
    p_bp_systolic, p_bp_diastolic,
    p_heart_rate, p_temperature_c, p_respiratory_rate, p_spo2,
    p_weight_kg, p_height_cm, v_bmi,
    v_critical, v_flags,
    p_clinical_note
  )
  RETURNING vital_signs.id INTO v_record_id;

  RETURN QUERY SELECT v_record_id, v_critical, v_flags;
END;
$$;

-- ─── Realtime (doctor screen updates live when nurse saves vitals) ─────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.vital_signs;
ALTER TABLE public.vital_signs REPLICA IDENTITY FULL;
