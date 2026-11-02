-- ─────────────────────────────────────────────────────────────────────────────
-- FR-013: Questionnaire Assignment & Response Collection
-- Tables: questionnaire_assignments, questionnaire_responses, questionnaire_answers
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE public.assignment_status AS ENUM (
  'PENDING',      -- assigned, patient hasn't started
  'IN_PROGRESS',  -- patient started filling
  'COMPLETED',    -- patient submitted
  'EXPIRED'       -- deadline passed without completion
);

-- ─── Questionnaire Assignments ────────────────────────────────────────────────
-- Links questionnaires to specific appointments/patients

CREATE TABLE public.questionnaire_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by      UUID NOT NULL REFERENCES auth.users(id),  -- doctor or admin
  status           public.assignment_status NOT NULL DEFAULT 'PENDING',
  due_at           TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  note             TEXT,  -- instructions for the patient
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.questionnaire_assignments IS
  'FR-013: Links questionnaires to appointments/patients for completion.';

-- ─── Questionnaire Responses (one per assignment) ────────────────────────────
-- The earlier migration (20260618100000_questionnaires.sql) created a minimal
-- stub of this table to back the RULE-012b "has responses" guard.
-- Drop the stub and recreate with the full FR-013 schema.

DROP TABLE IF EXISTS public.questionnaire_responses CASCADE;

CREATE TABLE public.questionnaire_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID NOT NULL UNIQUE REFERENCES public.questionnaire_assignments(id) ON DELETE CASCADE,
  patient_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score    NUMERIC,     -- computed from scoring rules
  score_label    TEXT,        -- e.g. 'Mild', 'Moderate', 'Severe'
  intervention   TEXT,        -- from intervention_matrix
  submitted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.questionnaire_responses IS
  'FR-013: Response records for questionnaire assignments, with computed score.';

-- ─── Individual Answers ───────────────────────────────────────────────────────

CREATE TABLE public.questionnaire_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id    UUID NOT NULL REFERENCES public.questionnaire_responses(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES public.questionnaire_questions(id),
  answer_value   JSONB NOT NULL,   -- flexible: string, number, array of strings, etc.
  score_value    NUMERIC,          -- computed per-answer score contribution
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.questionnaire_answers IS
  'FR-013: Individual question answers within a questionnaire response.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX qa_patient_status_idx   ON public.questionnaire_assignments (patient_id, status);
CREATE INDEX qa_appointment_idx      ON public.questionnaire_assignments (appointment_id);
CREATE INDEX qr_assignment_idx       ON public.questionnaire_responses (assignment_id);
CREATE INDEX qans_response_idx       ON public.questionnaire_answers (response_id);

-- ─── Updated At Triggers ─────────────────────────────────────────────────────

CREATE TRIGGER assignment_set_updated_at
  BEFORE UPDATE ON public.questionnaire_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER response_set_updated_at
  BEFORE UPDATE ON public.questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.questionnaire_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_answers     ENABLE ROW LEVEL SECURITY;

-- Patients: read their own assignments
CREATE POLICY "qa_patient_select" ON public.questionnaire_assignments
  FOR SELECT USING (patient_id = auth.uid());

-- Doctors/staff: read all assignments (to check completion)
CREATE POLICY "qa_doctor_read" ON public.questionnaire_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('doctor', 'staff'))
  );

-- Doctors/admin: assign questionnaires
CREATE POLICY "qa_doctor_insert" ON public.questionnaire_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('doctor', 'admin'))
  );

-- Admin: full access
CREATE POLICY "qa_admin_all" ON public.questionnaire_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Responses: patients read/write their own
CREATE POLICY "qr_patient_rw" ON public.questionnaire_responses
  FOR ALL USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "qr_doctor_read" ON public.questionnaire_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('doctor', 'staff', 'admin'))
  );

-- Answers: same as responses
CREATE POLICY "qans_patient_rw" ON public.questionnaire_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.questionnaire_responses qr
      WHERE qr.id = response_id AND qr.patient_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questionnaire_responses qr
      WHERE qr.id = response_id AND qr.patient_id = auth.uid()
    )
  );

CREATE POLICY "qans_doctor_read" ON public.questionnaire_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('doctor', 'staff', 'admin'))
  );

-- ─── RPC: assign_questionnaire ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_questionnaire(
  p_questionnaire_id UUID,
  p_patient_id       UUID,
  p_appointment_id   UUID   DEFAULT NULL,
  p_due_at           TIMESTAMPTZ DEFAULT NULL,
  p_note             TEXT   DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id   UUID;
  v_role        TEXT;
  v_assign_id   UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_doctor_id;
  IF v_role NOT IN ('doctor', 'admin', 'staff') THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.questionnaire_assignments (
    questionnaire_id, appointment_id, patient_id, assigned_by, due_at, note
  ) VALUES (
    p_questionnaire_id, p_appointment_id, p_patient_id, v_doctor_id, p_due_at, p_note
  )
  RETURNING id INTO v_assign_id;

  RETURN v_assign_id;
END;
$$;

-- ─── RPC: submit_questionnaire_response ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_questionnaire_response(
  p_assignment_id UUID,
  p_answers       JSONB  -- array of { question_id, answer_value, score_value }
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_patient_id  UUID;
  v_assign      RECORD;
  v_response_id UUID;
  v_total_score NUMERIC := 0;
  v_answer      JSONB;
BEGIN
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_assign
  FROM public.questionnaire_assignments
  WHERE id = p_assignment_id AND patient_id = v_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_assign.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED' USING errcode = 'P0004';
  END IF;

  -- Create or update response record
  INSERT INTO public.questionnaire_responses (assignment_id, patient_id)
  VALUES (p_assignment_id, v_patient_id)
  ON CONFLICT (assignment_id) DO NOTHING
  RETURNING id INTO v_response_id;

  IF v_response_id IS NULL THEN
    SELECT id INTO v_response_id FROM public.questionnaire_responses WHERE assignment_id = p_assignment_id;
  END IF;

  -- Delete old answers if re-submitting
  DELETE FROM public.questionnaire_answers WHERE response_id = v_response_id;

  -- Insert answers and compute total score
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

  -- Update response with total score and mark as submitted
  UPDATE public.questionnaire_responses SET
    total_score  = v_total_score,
    submitted_at = now()
  WHERE id = v_response_id;

  -- Mark assignment as completed
  UPDATE public.questionnaire_assignments SET
    status       = 'COMPLETED',
    completed_at = now()
  WHERE id = p_assignment_id;

  RETURN v_response_id;
END;
$$;

-- ─── Realtime for patient portal (see new assignments) ───────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.questionnaire_assignments;
