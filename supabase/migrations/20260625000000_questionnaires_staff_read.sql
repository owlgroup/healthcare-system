-- Allow doctors/staff to read published questionnaires in the examination screen.
-- Implements the commented RULE-012a policy from 20260618100000_questionnaires.sql.

CREATE POLICY "questionnaires_staff_active_read" ON public.questionnaires
  FOR SELECT
  USING (
    status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'staff')
    )
  );

-- Patients may read questionnaires assigned to them (for filling responses).
CREATE POLICY "questionnaires_patient_assigned_read" ON public.questionnaires
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questionnaire_assignments qa
      WHERE qa.questionnaire_id = questionnaires.id
        AND qa.patient_id = auth.uid()
    )
  );

-- Staff read sections/questions of published questionnaires (preview / scoring).
CREATE POLICY "questionnaire_sections_staff_active_read" ON public.questionnaire_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questionnaires q
      JOIN public.user_profiles up ON up.user_id = auth.uid()
      WHERE q.id = questionnaire_sections.questionnaire_id
        AND q.status = 'ACTIVE'
        AND up.role IN ('doctor', 'staff')
    )
  );

CREATE POLICY "questionnaire_questions_staff_active_read" ON public.questionnaire_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questionnaire_sections qs
      JOIN public.questionnaires q ON q.id = qs.questionnaire_id
      JOIN public.user_profiles up ON up.user_id = auth.uid()
      WHERE qs.id = questionnaire_questions.section_id
        AND q.status = 'ACTIVE'
        AND up.role IN ('doctor', 'staff')
    )
  );

-- Patients read sections/questions for assigned questionnaires only.
CREATE POLICY "questionnaire_sections_patient_assigned_read" ON public.questionnaire_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questionnaire_assignments qa
      WHERE qa.questionnaire_id = questionnaire_sections.questionnaire_id
        AND qa.patient_id = auth.uid()
    )
  );

CREATE POLICY "questionnaire_questions_patient_assigned_read" ON public.questionnaire_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questionnaire_sections qs
      JOIN public.questionnaire_assignments qa ON qa.questionnaire_id = qs.questionnaire_id
      WHERE qs.id = questionnaire_questions.section_id
        AND qa.patient_id = auth.uid()
    )
  );
