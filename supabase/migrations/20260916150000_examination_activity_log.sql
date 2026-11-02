-- TC-DLS-403: persist who saved a SOAP exam, without logging PHI.

CREATE TABLE IF NOT EXISTS public.examination_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.medical_examinations (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('UPDATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_examination_activity_logs_exam_created
  ON public.examination_activity_logs (exam_id, created_at DESC);

ALTER TABLE public.examination_activity_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.examination_activity_logs FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.save_soap_draft(
  p_exam_id   UUID,
  p_s_text    TEXT    DEFAULT NULL,
  p_o_text    TEXT    DEFAULT NULL,
  p_a_text    TEXT    DEFAULT NULL,
  p_p_text    TEXT    DEFAULT NULL,
  p_manual    BOOLEAN DEFAULT FALSE
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

    INSERT INTO public.examination_activity_logs (exam_id, actor_id, actor_name, action)
    VALUES (p_exam_id, v_doctor_id, v_actor_name, 'UPDATED');
  END IF;

  RETURN p_exam_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_examination_activity_log(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  actor_id UUID,
  actor_name TEXT,
  action TEXT,
  created_at TIMESTAMPTZ
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
    l.created_at
  FROM public.examination_activity_logs l
  WHERE l.exam_id = p_exam_id
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_examination_activity_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_examination_activity_log(uuid) TO authenticated;
