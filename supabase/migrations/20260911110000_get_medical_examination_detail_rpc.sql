-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Get Medical Examination Detail RPC
-- Purpose: Admin function to get full medical examination details for signature log
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_medical_examination_detail(
  p_exam_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check admin role
  IF NOT public._delta_log_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'exam', jsonb_build_object(
      'id', me.id,
      'appointment_id', me.appointment_id,
      's_text', me.s_text,
      'o_text', me.o_text,
      'a_text', me.a_text,
      'p_text', me.p_text,
      'status', me.status
    ),
    'appointment', jsonb_build_object(
      'id', a.id,
      'created_at', a.created_at,
      'status', a.status
    ),
    'patient', jsonb_build_object(
      'full_name', TRIM(COALESCE(pt.legal_first_name, '') || ' ' || COALESCE(pt.legal_last_name, '')),
      'date_of_birth', pt.date_of_birth,
      'phone', pt.phone_number
    ),
    'doctor', jsonb_build_object(
      'full_name', doc.full_name,
      'specialty_name', sp.name
    ),
    'slot', jsonb_build_object(
      'slot_date', slot.slot_date,
      'start_time', slot.start_time
    ),
    'vitals', (
      SELECT jsonb_build_object(
        'systolic_bp', vs.systolic_bp,
        'diastolic_bp', vs.diastolic_bp,
        'heart_rate', vs.heart_rate,
        'temperature', vs.temperature,
        'respiratory_rate', vs.respiratory_rate,
        'spo2', vs.spo2,
        'weight', vs.weight,
        'height', vs.height
      )
      FROM public.vital_signs vs
      WHERE vs.appointment_id = me.appointment_id
      ORDER BY vs.recorded_at DESC
      LIMIT 1
    ),
    'pre_consultation', (
      SELECT jsonb_build_object(
        'chief_complaint', pc.chief_complaint,
        'duration', pc.duration,
        'associated_symptoms', pc.associated_symptoms,
        'medical_history', pc.medical_history,
        'current_medications', pc.current_medications
      )
      FROM public.pre_consultations pc
      WHERE pc.appointment_id = me.appointment_id
      LIMIT 1
    )
  )
  INTO v_result
  FROM public.medical_examinations me
  JOIN public.appointments a ON a.id = me.appointment_id
  LEFT JOIN public.patient pt ON pt.id = a.profile_id
  LEFT JOIN public.specialties sp ON sp.id = a.specialty_id
  LEFT JOIN public.appointment_slots slot ON slot.appointment_id = a.id
  LEFT JOIN public.user_profiles doc ON doc.user_id = slot.doctor_id
  WHERE me.id = p_exam_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_medical_examination_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_medical_examination_detail(uuid) TO authenticated;
