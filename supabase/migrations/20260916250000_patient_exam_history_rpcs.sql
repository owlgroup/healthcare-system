-- Patient-scoped appointment audit + examination activity logs.
-- Also allow the patient to list activity on their own LOCKED exams.

CREATE OR REPLACE FUNCTION public.list_patient_appointments_audit_log(
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
      TRIM(COALESCE(pt.legal_first_name, '') || ' ' || COALESCE(pt.legal_last_name, '')) AS patient_name,
      doc.full_name AS doctor_name
    FROM public.appointments_audit_log a
    LEFT JOIN public.user_profiles up ON up.user_id = a.performed_by
    LEFT JOIN public.appointments appt ON appt.id = a.appointment_id
    LEFT JOIN public.specialties sp ON sp.id = appt.specialty_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    LEFT JOIN public.appointment_slots slot ON slot.id = appt.slot_id
    LEFT JOIN public.user_profiles doc ON doc.user_id = slot.doctor_id
    WHERE
      appt.patient_id = v_user_id
      AND (v_action IS NULL OR a.action = v_action)
      AND (
        v_query IS NULL
        OR a.action ILIKE '%' || v_query || '%'
        OR a.notes ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(sp.name, '') ILIKE '%' || v_query || '%'
        OR coalesce(doc.full_name, '') ILIKE '%' || v_query || '%'
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

REVOKE ALL ON FUNCTION public.list_patient_appointments_audit_log(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_patient_appointments_audit_log(text, integer, integer, text) TO authenticated;

COMMENT ON FUNCTION public.list_patient_appointments_audit_log IS
  'List appointments audit log filtered to the current patient''s appointments';

CREATE OR REPLACE FUNCTION public.list_patient_examination_activity_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10
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

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      l.id,
      l.exam_id,
      l.actor_id,
      l.actor_name,
      l.action,
      l.created_at,
      l.changed_fields,
      l.related_exam_id,
      me.appointment_id,
      nullif(trim(
        coalesce(pt.legal_first_name, '') || ' ' || coalesce(pt.legal_last_name, '')
      ), '') AS patient_name
    FROM public.examination_activity_logs l
    INNER JOIN public.medical_examinations me ON me.id = l.exam_id
    LEFT JOIN public.appointments appt ON appt.id = me.appointment_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    LEFT JOIN public.specialties sp ON sp.id = appt.specialty_id
    WHERE
      me.patient_id = v_user_id
      AND (
        v_query IS NULL
        OR coalesce(l.actor_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(sp.name, '') ILIKE '%' || v_query || '%'
        OR coalesce(l.action, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC
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

REVOKE ALL ON FUNCTION public.list_patient_examination_activity_log(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_patient_examination_activity_log(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.list_patient_examination_activity_log IS
  'List examination activity logs for exams belonging to the current patient';

DROP FUNCTION IF EXISTS public.list_examination_activity_log(uuid);

CREATE OR REPLACE FUNCTION public.list_examination_activity_log(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  actor_id UUID,
  actor_name TEXT,
  action TEXT,
  created_at TIMESTAMPTZ,
  changed_fields TEXT[],
  related_exam_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT public._delta_log_is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.medical_examinations me
       WHERE me.id = p_exam_id
         AND me.doctor_id = v_uid
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.medical_examinations me
       WHERE me.id = p_exam_id
         AND me.patient_id = v_uid
         AND me.status = 'LOCKED'
     )
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.exam_id,
    l.actor_id,
    l.actor_name,
    l.action,
    l.created_at,
    l.changed_fields,
    l.related_exam_id
  FROM public.examination_activity_logs l
  WHERE l.exam_id = p_exam_id
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_examination_activity_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_examination_activity_log(uuid) TO authenticated;
