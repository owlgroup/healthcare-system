-- FR-012: Server-side delete with assignment/response guards

CREATE OR REPLACE FUNCTION public.delete_questionnaire(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.questionnaire_responses qr
    INNER JOIN public.questionnaire_assignments qa ON qa.id = qr.assignment_id
    WHERE qa.questionnaire_id = p_id
  ) THEN
    RAISE EXCEPTION 'DELETE_HAS_RESPONSES';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questionnaire_assignments
    WHERE questionnaire_id = p_id
  ) THEN
    RAISE EXCEPTION 'HAS_ASSIGNMENTS';
  END IF;

  DELETE FROM public.questionnaires WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_questionnaire(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_questionnaire(UUID) TO authenticated;
