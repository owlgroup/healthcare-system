-- Add addendum details (reason and SOAP snapshot) to examination version history.
-- For ADDENDUM_CREATED entries, fetch the linked addendum exam's amendment_reason and SOAP fields.

DROP FUNCTION IF EXISTS public.get_examination_version_history(uuid);

CREATE OR REPLACE FUNCTION public.get_examination_version_history(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  action TEXT,
  actor_name TEXT,
  created_at TIMESTAMPTZ,
  changed_fields TEXT[],
  soap_snapshot JSONB,
  is_current BOOLEAN,
  related_exam_id UUID,
  addendum_reason TEXT,
  addendum_soap_snapshot JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_exam_exists BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Check if exam exists and user has access (owning doctor or admin)
  SELECT EXISTS (
    SELECT 1
    FROM public.medical_examinations me
    LEFT JOIN public.user_profiles up ON up.user_id = v_uid
    WHERE me.id = p_exam_id
      AND (me.doctor_id = v_uid OR up.role = 'admin')
  ) INTO v_exam_exists;

  IF NOT v_exam_exists THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  WITH numbered AS (
    SELECT
      l.id,
      ROW_NUMBER() OVER (ORDER BY l.created_at ASC) AS version,
      l.action,
      l.actor_name,
      l.created_at,
      l.changed_fields,
      l.soap_snapshot,
      ROW_NUMBER() OVER (ORDER BY l.created_at DESC) = 1 AS is_current,
      l.related_exam_id
    FROM public.examination_activity_logs l
    WHERE l.exam_id = p_exam_id
  )
  SELECT
    n.id,
    n.version::INTEGER,
    n.action,
    n.actor_name,
    n.created_at,
    n.changed_fields,
    n.soap_snapshot,
    n.is_current,
    n.related_exam_id,
    -- Addendum details: only populated when action = 'ADDENDUM_CREATED' and related_exam_id exists
    CASE
      WHEN n.action = 'ADDENDUM_CREATED' AND n.related_exam_id IS NOT NULL
      THEN addendum.amendment_reason
      ELSE NULL
    END AS addendum_reason,
    CASE
      WHEN n.action = 'ADDENDUM_CREATED' AND n.related_exam_id IS NOT NULL
      THEN jsonb_build_object(
        's_text', addendum.s_text,
        'o_text', addendum.o_text,
        'a_text', addendum.a_text,
        'p_text', addendum.p_text
      )
      ELSE NULL
    END AS addendum_soap_snapshot
  FROM numbered n
  LEFT JOIN public.medical_examinations addendum
    ON n.related_exam_id = addendum.id
    AND n.action = 'ADDENDUM_CREATED'
  ORDER BY n.version DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_examination_version_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_examination_version_history(uuid) TO authenticated;
