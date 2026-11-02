-- Add patient name and visit time to admin signature log list.

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
      nullif(trim(
        coalesce(pt.legal_first_name, '') || ' ' || coalesce(pt.legal_last_name, '')
      ), '') AS patient_name,
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

REVOKE ALL ON FUNCTION public.list_signature_logs(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signature_logs(text, integer, integer, text) TO authenticated;
