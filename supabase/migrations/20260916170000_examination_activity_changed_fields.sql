-- Track which SOAP sections changed on a manual save (no PHI).

ALTER TABLE public.examination_activity_logs
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[] NOT NULL DEFAULT '{}'::text[];

DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.save_soap_draft(
  p_exam_id         UUID,
  p_s_text          TEXT    DEFAULT NULL,
  p_o_text          TEXT    DEFAULT NULL,
  p_a_text          TEXT    DEFAULT NULL,
  p_p_text          TEXT    DEFAULT NULL,
  p_manual          BOOLEAN DEFAULT FALSE,
  p_changed_fields  TEXT[]  DEFAULT '{}'::text[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id   UUID;
  v_status      public.exam_status;
  v_owner       UUID;
  v_actor_name  TEXT;
  v_fields      TEXT[];
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT status, doctor_id INTO v_status, v_owner
  FROM public.medical_examinations
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_owner != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'LOCKED' THEN
    RAISE EXCEPTION 'EXAM_LOCKED' USING errcode = 'P0020';
  END IF;

  IF p_s_text IS NOT NULL AND trim(p_s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: s_text cannot be empty' USING errcode = 'P0010';
  END IF;

  UPDATE public.medical_examinations SET
    s_text        = COALESCE(p_s_text, s_text),
    o_text        = COALESCE(p_o_text, o_text),
    a_text        = COALESCE(p_a_text, a_text),
    p_text        = COALESCE(p_p_text, p_text),
    auto_saved_at = now()
  WHERE id = p_exam_id;

  IF p_manual THEN
    SELECT nullif(trim(up.full_name), '')
      INTO v_actor_name
    FROM public.user_profiles up
    WHERE up.user_id = v_doctor_id;

    SELECT coalesce(array_agg(f), '{}'::text[])
      INTO v_fields
    FROM unnest(coalesce(p_changed_fields, '{}'::text[])) AS f
    WHERE f IN ('s_text', 'o_text', 'a_text', 'p_text');

    INSERT INTO public.examination_activity_logs (
      exam_id, actor_id, actor_name, action, changed_fields
    )
    VALUES (p_exam_id, v_doctor_id, v_actor_name, 'UPDATED', v_fields);
  END IF;

  RETURN p_exam_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) TO authenticated;

DROP FUNCTION IF EXISTS public.list_examination_activity_log(uuid);

CREATE OR REPLACE FUNCTION public.list_examination_activity_log(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  actor_id UUID,
  actor_name TEXT,
  action TEXT,
  created_at TIMESTAMPTZ,
  changed_fields TEXT[]
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.medical_examinations me
    WHERE me.id = p_exam_id
      AND me.doctor_id = v_uid
  ) THEN
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
    l.changed_fields
  FROM public.examination_activity_logs l
  WHERE l.exam_id = p_exam_id
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_examination_activity_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_examination_activity_log(uuid) TO authenticated;

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
      l.changed_fields,
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
