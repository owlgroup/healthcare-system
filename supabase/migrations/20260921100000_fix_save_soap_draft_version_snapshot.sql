-- Fix: previous 20260920100000 recreated 6-arg save_soap_draft and left the
-- 7-arg overload (with p_changed_fields) without soap_snapshot. Frontend always
-- calls the 7-arg form, so manual saves never stored version snapshots.

DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text, boolean, text[]);

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
  v_doctor_id     UUID;
  v_status        public.exam_status;
  v_owner         UUID;
  v_actor_name    TEXT;
  v_fields        TEXT[];
  v_new_snapshot  JSONB;
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

    SELECT jsonb_build_object(
      's_text', s_text,
      'o_text', o_text,
      'a_text', a_text,
      'p_text', p_text
    ) INTO v_new_snapshot
    FROM public.medical_examinations
    WHERE id = p_exam_id;

    INSERT INTO public.examination_activity_logs (
      exam_id, actor_id, actor_name, action, changed_fields, soap_snapshot
    )
    VALUES (
      p_exam_id, v_doctor_id, v_actor_name, 'UPDATED', v_fields, v_new_snapshot
    );
  END IF;

  RETURN p_exam_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) TO authenticated;
