-- Doctor-scoped list of SOAP save activity for the medical-history system log tab.

CREATE OR REPLACE FUNCTION public.list_doctor_examination_activity_log(
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

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = v_user_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
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
      me.appointment_id,
      nullif(trim(
        coalesce(pt.legal_first_name, '') || ' ' || coalesce(pt.legal_last_name, '')
      ), '') AS patient_name
    FROM public.examination_activity_logs l
    INNER JOIN public.medical_examinations me ON me.id = l.exam_id
    LEFT JOIN public.appointments appt ON appt.id = me.appointment_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    WHERE
      me.doctor_id = v_user_id
      AND (
        v_query IS NULL
        OR coalesce(l.actor_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_first_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_last_name, '') ILIKE '%' || v_query || '%'
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

REVOKE ALL ON FUNCTION public.list_doctor_examination_activity_log(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_doctor_examination_activity_log(text, integer, integer) TO authenticated;
