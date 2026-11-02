-- Allow doctors/staff to submit questionnaire answers during examination
-- (existing RPC only permitted patient_id = auth.uid()).

CREATE OR REPLACE FUNCTION public.submit_questionnaire_response(
  p_assignment_id UUID,
  p_answers       JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id   UUID;
  v_role        TEXT;
  v_assign      RECORD;
  v_patient_id  UUID;
  v_response_id UUID;
  v_total_score NUMERIC := 0;
  v_answer      JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_assign
  FROM public.questionnaire_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_assign.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED' USING errcode = 'P0004';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_caller_id;

  IF v_assign.patient_id = v_caller_id THEN
    v_patient_id := v_caller_id;
  ELSIF v_role IN ('doctor', 'staff', 'admin') THEN
    v_patient_id := v_assign.patient_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.questionnaire_responses (assignment_id, patient_id)
  VALUES (p_assignment_id, v_patient_id)
  ON CONFLICT (assignment_id) DO NOTHING
  RETURNING id INTO v_response_id;

  IF v_response_id IS NULL THEN
    SELECT id INTO v_response_id
    FROM public.questionnaire_responses
    WHERE assignment_id = p_assignment_id;
  END IF;

  DELETE FROM public.questionnaire_answers WHERE response_id = v_response_id;

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    INSERT INTO public.questionnaire_answers (response_id, question_id, answer_value, score_value)
    VALUES (
      v_response_id,
      (v_answer->>'question_id')::UUID,
      v_answer->'answer_value',
      (v_answer->>'score_value')::NUMERIC
    );
    v_total_score := v_total_score + COALESCE((v_answer->>'score_value')::NUMERIC, 0);
  END LOOP;

  UPDATE public.questionnaire_responses SET
    total_score  = v_total_score,
    submitted_at = now()
  WHERE id = v_response_id;

  UPDATE public.questionnaire_assignments SET
    status       = 'COMPLETED',
    completed_at = now()
  WHERE id = p_assignment_id;

  RETURN v_response_id;
END;
$$;
