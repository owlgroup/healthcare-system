-- Allow doctors to UPDATE their own vital sign records.
CREATE POLICY "vital_signs_doctor_update" ON public.vital_signs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')
    )
  );

-- RPC: update_vital_signs — recomputes BMI and critical flags on edit.
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
) RETURNS TABLE (id UUID, is_critical BOOLEAN, critical_flags TEXT[])
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bmi            NUMERIC;
  v_is_critical    BOOLEAN := FALSE;
  v_critical_flags TEXT[]  := '{}';
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  -- Recompute BMI
  IF p_weight_kg IS NOT NULL AND p_weight_kg > 0
     AND p_height_cm IS NOT NULL AND p_height_cm > 0 THEN
    v_bmi := ROUND((p_weight_kg / POWER(p_height_cm / 100.0, 2))::NUMERIC, 1);
  END IF;

  -- Critical flags
  IF p_bp_systolic IS NOT NULL AND p_bp_systolic > 200 THEN
    v_is_critical    := TRUE;
    v_critical_flags := v_critical_flags || 'BP_HIGH';
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate < 40 THEN
    v_is_critical    := TRUE;
    v_critical_flags := v_critical_flags || 'HR_LOW';
  END IF;
  IF p_heart_rate IS NOT NULL AND p_heart_rate > 150 THEN
    v_is_critical    := TRUE;
    v_critical_flags := v_critical_flags || 'HR_HIGH';
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
