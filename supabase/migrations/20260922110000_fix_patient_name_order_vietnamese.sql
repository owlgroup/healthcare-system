-- Fix patient name order for Vietnamese naming convention.
-- Vietnamese names: Họ (last name) + Tên đệm + Tên (first name)
-- Change from: legal_first_name + ' ' + legal_last_name
-- To: legal_last_name + ' ' + legal_first_name

-- Fix list_doctor_appointments_audit_log
CREATE OR REPLACE FUNCTION public.list_doctor_appointments_audit_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_query text;
  v_action text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = v_user_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_action := nullif(trim(coalesce(p_action, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      a.id,
      a.appointment_id,
      a.action,
      a.performed_by,
      a.performed_at,
      a.old_status,
      a.new_status,
      a.notes,
      up.full_name AS performed_by_name,
      sp.name AS specialty_name,
      TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, '')) AS patient_name,
      doc.full_name AS doctor_name
    FROM public.appointments_audit_log a
    LEFT JOIN public.user_profiles up ON up.user_id = a.performed_by
    LEFT JOIN public.appointments appt ON appt.id = a.appointment_id
    LEFT JOIN public.specialties sp ON sp.id = appt.specialty_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    LEFT JOIN public.appointment_slots slot ON slot.id = appt.slot_id
    LEFT JOIN public.user_profiles doc ON doc.user_id = slot.doctor_id
    WHERE
      slot.doctor_id = v_user_id
      AND (v_action IS NULL OR a.action = v_action)
      AND (
        v_query IS NULL
        OR a.action ILIKE '%' || v_query || '%'
        OR a.notes ILIKE '%' || v_query || '%'
        OR a.appointment_id::text ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(sp.name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_first_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_last_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.performed_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- Fix list_signature_logs (admin)
CREATE OR REPLACE FUNCTION public.list_signature_logs(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_target_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_target_type text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public._delta_log_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_target_type := nullif(trim(coalesce(p_target_type, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      s.id,
      s.target_type,
      s.target_id,
      s.signed_by,
      s.data_hash,
      s.ip_address,
      s.user_agent,
      s.signed_at,
      up.full_name AS signed_by_name,
      me.appointment_id,
      TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, '')) AS patient_name,
      CASE
        WHEN slot.slot_date IS NOT NULL AND slot.start_time IS NOT NULL
        THEN (slot.slot_date + slot.start_time)::timestamptz
        ELSE NULL
      END AS visit_at
    FROM public.signature_logs s
    LEFT JOIN public.user_profiles up ON up.user_id = s.signed_by
    LEFT JOIN public.medical_examinations me ON me.id = s.target_id
    LEFT JOIN public.appointments appt ON appt.id = me.appointment_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    LEFT JOIN public.appointment_slots slot ON slot.id = appt.slot_id
    WHERE
      (v_target_type IS NULL OR s.target_type = v_target_type)
      AND (
        v_query IS NULL
        OR s.target_type ILIKE '%' || v_query || '%'
        OR s.target_id::text ILIKE '%' || v_query || '%'
        OR s.data_hash ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_first_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_last_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.signed_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- Fix get_medical_examination_detail patient full_name
CREATE OR REPLACE FUNCTION public.get_medical_examination_detail(p_exam_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'id', me.id,
    'appointment_id', me.appointment_id,
    'patient_id', me.patient_id,
    'doctor_id', me.doctor_id,
    's_text', me.s_text,
    'o_text', me.o_text,
    'a_text', me.a_text,
    'p_text', me.p_text,
    'status', me.status,
    'is_addendum', me.is_addendum,
    'parent_exam_id', me.parent_exam_id,
    'amendment_reason', me.amendment_reason,
    'auto_saved_at', me.auto_saved_at,
    'created_at', me.created_at,
    'updated_at', me.updated_at,
    'patient', CASE
      WHEN pt.id IS NOT NULL THEN jsonb_build_object(
        'id', pt.id,
        'full_name', TRIM(COALESCE(pt.legal_last_name, '') || ' ' || COALESCE(pt.legal_first_name, '')),
        'date_of_birth', pt.date_of_birth,
        'phone', pt.phone_number
      )
      ELSE NULL
    END,
    'doctor', CASE
      WHEN doc.user_id IS NOT NULL THEN jsonb_build_object(
        'id', doc.user_id,
        'full_name', doc.full_name
      )
      ELSE NULL
    END,
    'appointment', CASE
      WHEN appt.id IS NOT NULL THEN jsonb_build_object(
        'id', appt.id,
        'specialty_id', appt.specialty_id,
        'slot_id', appt.slot_id,
        'slot_date', slot.slot_date,
        'start_time', slot.start_time,
        'end_time', slot.end_time
      )
      ELSE NULL
    END
  )
  INTO v_result
  FROM public.medical_examinations me
  LEFT JOIN public.patient pt ON pt.id = me.patient_id
  LEFT JOIN public.user_profiles doc ON doc.user_id = me.doctor_id
  LEFT JOIN public.appointments appt ON appt.id = me.appointment_id
  LEFT JOIN public.appointment_slots slot ON slot.id = appt.slot_id
  WHERE me.id = p_exam_id
    AND (
      me.doctor_id = v_uid
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = v_uid AND role = 'admin')
    );

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;
