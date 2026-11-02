-- Add patient_name and doctor_name to appointments audit log RPC

CREATE OR REPLACE FUNCTION public.list_appointments_audit_log(
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
  v_query text;
  v_action text;
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
    LEFT JOIN public.appointment_slots slot ON slot.appointment_id = appt.id
    LEFT JOIN public.user_profiles doc ON doc.user_id = slot.doctor_id
    WHERE
      (v_action IS NULL OR a.action = v_action)
      AND (
        v_query IS NULL
        OR a.action ILIKE '%' || v_query || '%'
        OR a.notes ILIKE '%' || v_query || '%'
        OR a.appointment_id::text ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(sp.name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_first_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_last_name, '') ILIKE '%' || v_query || '%'
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
