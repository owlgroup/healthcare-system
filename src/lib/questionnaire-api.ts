import { supabase } from '@/lib/supabase';
import type {
  InterventionRule,
  Questionnaire,
  QuestionnaireQuestion,
  QuestionnaireSection,
  QuestionnaireWithSections,
  ScoringConfig,
} from '@/types/questionnaire';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string { return String(v ?? ''); }
function strNull(v: unknown): string | null { return v != null ? String(v) : null; }

export function mapQuestionnaireError(msg: string): string {
  if (msg.includes('HAS_RESPONSES'))
    return 'Không thể sửa: bộ câu hỏi đã có phản hồi. Hãy Clone phiên bản mới.';
  if (msg.includes('DELETE_HAS_RESPONSES'))
    return 'Không thể xóa: bộ câu hỏi đã có phản hồi.';
  if (msg.includes('HAS_ASSIGNMENTS'))
    return 'Không thể xóa: bộ câu hỏi đã được gán cho bệnh nhân.';
  if (msg.includes('NOT_FOUND'))
    return 'Bộ câu hỏi không tồn tại.';
  if (msg.includes('EMPTY_QUESTIONNAIRE'))
    return 'Cần ít nhất 1 phần và 1 câu hỏi để phát hành.';
  return msg;
}

export async function hasResponses(questionnaireId: string): Promise<boolean> {
  const { data: assignments, error: assignmentsError } = await supabase
    .from('questionnaire_assignments')
    .select('id')
    .eq('questionnaire_id', questionnaireId);
  if (assignmentsError) throw new Error(assignmentsError.message);

  const assignmentIds = (assignments ?? []).map((row) => str(row.id));
  if (assignmentIds.length === 0) return false;

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('id')
    .in('assignment_id', assignmentIds)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function assertNoResponses(questionnaireId: string): Promise<void> {
  if (await hasResponses(questionnaireId)) {
    throw new Error(mapQuestionnaireError('HAS_RESPONSES'));
  }
}

// ─── List / fetch ──────────────────────────────────────────────────────────

const QUESTIONNAIRE_LIST_SELECT =
  'id, name, category_id, description, status, version, parent_id, intervention_matrix, scoring_config, created_at, updated_at, question_categories(name)';

function mapQuestionnaireRow(r: Record<string, unknown>): Questionnaire {
  return {
    id:                  str(r.id),
    name:                str(r.name),
    category_id:         strNull(r.category_id),
    category_name:       (r.question_categories as { name: string } | null)?.name ?? '—',
    description:         strNull(r.description),
    status:              r.status as Questionnaire['status'],
    version:             Number(r.version ?? 1),
    parent_id:           strNull(r.parent_id),
    intervention_matrix: (r.intervention_matrix ?? []) as InterventionRule[],
    scoring_config:      (r.scoring_config ?? {}) as ScoringConfig,
    created_at:          str(r.created_at),
    updated_at:          str(r.updated_at),
  };
}

export async function fetchQuestionnaires(): Promise<Questionnaire[]> {
  const { data, error } = await supabase
    .from('questionnaires')
    .select(QUESTIONNAIRE_LIST_SELECT)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(mapQuestionnaireRow);
}

/** Published (ACTIVE) questionnaires for doctor examination assignment. */
export async function fetchActiveQuestionnaires(): Promise<Questionnaire[]> {
  const { data, error } = await supabase
    .from('questionnaires')
    .select(QUESTIONNAIRE_LIST_SELECT)
    .eq('status', 'ACTIVE')
    .order('name');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(mapQuestionnaireRow);
}

export async function fetchQuestionnaireById(id: string): Promise<QuestionnaireWithSections> {
  const { data, error } = await supabase
    .from('questionnaires')
    .select('id, name, category_id, description, status, version, parent_id, intervention_matrix, scoring_config, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const { data: sectionRows, error: sectionsError } = await supabase
    .from('questionnaire_sections')
    .select('id, questionnaire_id, key, role, title, sort_order')
    .eq('questionnaire_id', id)
    .order('sort_order');
  if (sectionsError) throw new Error(sectionsError.message);

  const sectionIds = (sectionRows ?? []).map((s) => s.id as string);
  let questionRows: Record<string, unknown>[] = [];
  if (sectionIds.length > 0) {
    const { data, error: questionsError } = await supabase
      .from('questionnaire_questions')
      .select('id, section_id, type, text, sort_order, options, config, skip_logic')
      .in('section_id', sectionIds)
      .order('sort_order');
    if (questionsError) throw new Error(questionsError.message);
    questionRows = (data ?? []) as Record<string, unknown>[];
  }

  const sections: QuestionnaireSection[] = (sectionRows ?? []).map((s) => ({
    id:               str(s.id),
    questionnaire_id: str(s.questionnaire_id),
    key:              str(s.key),
    role:             s.role as QuestionnaireSection['role'],
    title:            str(s.title),
    sort_order:       Number(s.sort_order ?? 0),
    questions:        questionRows
      .filter((q) => q.section_id === s.id)
      .map((q) => ({
        id:         str(q.id),
        section_id: str(q.section_id),
        type:       q.type as QuestionnaireQuestion['type'],
        text:       str(q.text),
        sort_order: Number(q.sort_order ?? 0),
        options:    (q.options ?? []) as QuestionnaireQuestion['options'],
        config:     (q.config ?? {}) as Record<string, unknown>,
        skip_logic: (q.skip_logic ?? []) as QuestionnaireQuestion['skip_logic'],
      })),
  }));

  return {
    id:                  str(data.id),
    name:                str(data.name),
    category_id:         strNull(data.category_id),
    description:         strNull(data.description),
    status:              data.status as Questionnaire['status'],
    version:             Number(data.version ?? 1),
    parent_id:           strNull(data.parent_id),
    intervention_matrix: (data.intervention_matrix ?? []) as InterventionRule[],
    scoring_config:      (data.scoring_config ?? {}) as ScoringConfig,
    created_at:          str(data.created_at),
    updated_at:          str(data.updated_at),
    sections,
  };
}

// ─── Create / update meta ────────────────────────────────────────────────────

export async function createQuestionnaire(payload: {
  name: string;
  category_id: string | null;
  description: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from('questionnaires')
    .insert({
      name:        payload.name.trim(),
      category_id: payload.category_id,
      description: strNull(payload.description),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return str(data.id);
}

export async function updateQuestionnaireMeta(id: string, payload: {
  name: string;
  category_id: string | null;
  description: string | null;
  intervention_matrix: InterventionRule[];
  scoring_config: ScoringConfig;
}): Promise<void> {
  await assertNoResponses(id);
  const { error } = await supabase
    .from('questionnaires')
    .update({
      name:                payload.name.trim(),
      category_id:         payload.category_id,
      description:         strNull(payload.description),
      intervention_matrix: payload.intervention_matrix,
      scoring_config:      payload.scoring_config,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Structure (sections + questions) ────────────────────────────────────────

export async function saveQuestionnaireStructure(
  questionnaireId: string,
  sections: QuestionnaireSection[],
): Promise<void> {
  await assertNoResponses(questionnaireId);

  // Sections/questions carry stable client-generated ids (see newId() in the
  // builder) so skip_logic.target_id references survive across saves —
  // upsert by id instead of delete-and-reinsert, then delete only what's gone.

  const { data: existingSectionRows, error: existingError } = await supabase
    .from('questionnaire_sections')
    .select('id')
    .eq('questionnaire_id', questionnaireId);
  if (existingError) throw new Error(existingError.message);

  const existingSectionIds = new Set((existingSectionRows ?? []).map((r) => str(r.id)));
  const incomingSectionIds = new Set(sections.map((s) => s.id));
  const sectionIdsToDelete = [...existingSectionIds].filter((id) => !incomingSectionIds.has(id));
  if (sectionIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('questionnaire_sections')
      .delete()
      .in('id', sectionIdsToDelete);
    if (deleteError) throw new Error(deleteError.message);
  }

  if (sections.length > 0) {
    const sectionRows = sections.map((section, i) => ({
      id:               section.id,
      questionnaire_id: questionnaireId,
      key:              section.key,
      role:             section.role,
      title:            section.title,
      sort_order:       i,
    }));
    const { error: sectionsError } = await supabase
      .from('questionnaire_sections')
      .upsert(sectionRows, { onConflict: 'id' });
    if (sectionsError) throw new Error(sectionsError.message);
  }

  const incomingQuestionIds = new Set(sections.flatMap((s) => s.questions.map((q) => q.id)));
  if (existingSectionIds.size > 0) {
    const { data: existingQuestionRows, error: existingQuestionsError } = await supabase
      .from('questionnaire_questions')
      .select('id')
      .in('section_id', [...existingSectionIds]);
    if (existingQuestionsError) throw new Error(existingQuestionsError.message);

    const questionIdsToDelete = (existingQuestionRows ?? [])
      .map((r) => str(r.id))
      .filter((id) => !incomingQuestionIds.has(id));
    if (questionIdsToDelete.length > 0) {
      const { error: deleteQuestionsError } = await supabase
        .from('questionnaire_questions')
        .delete()
        .in('id', questionIdsToDelete);
      if (deleteQuestionsError) throw new Error(deleteQuestionsError.message);
    }
  }

  const questionRows = sections.flatMap((section) =>
    section.questions.map((q, qi) => ({
      id:         q.id,
      section_id: section.id,
      type:       q.type,
      text:       q.text,
      sort_order: qi,
      options:    q.options,
      config:     q.config,
      skip_logic: q.skip_logic,
    })),
  );
  if (questionRows.length > 0) {
    const { error: questionsError } = await supabase
      .from('questionnaire_questions')
      .upsert(questionRows, { onConflict: 'id' });
    if (questionsError) throw new Error(questionsError.message);
  }
}

// ─── Publish / archive ────────────────────────────────────────────────────────

export async function publishQuestionnaire(id: string): Promise<void> {
  const questionnaire = await fetchQuestionnaireById(id);
  const hasAtLeastOneQuestion = questionnaire.sections.some((s) => s.questions.length > 0);
  if (questionnaire.sections.length === 0 || !hasAtLeastOneQuestion) {
    throw new Error(mapQuestionnaireError('EMPTY_QUESTIONNAIRE'));
  }
  const { error } = await supabase
    .from('questionnaires')
    .update({ status: 'ACTIVE' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archiveQuestionnaire(id: string): Promise<void> {
  const { error } = await supabase
    .from('questionnaires')
    .update({ status: 'ARCHIVED' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_questionnaire', { p_id: id });
  if (!error) return;

  const rpcMissing =
    error.code === 'PGRST202'
    || error.message.includes('Could not find the function')
    || error.message.includes('delete_questionnaire');

  if (!rpcMissing) {
    throw new Error(mapQuestionnaireError(error.message));
  }

  await deleteQuestionnaireDirect(id);
}

async function deleteQuestionnaireDirect(id: string): Promise<void> {
  if (await hasResponses(id)) {
    throw new Error('DELETE_HAS_RESPONSES');
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('questionnaire_assignments')
    .select('id')
    .eq('questionnaire_id', id)
    .limit(1);
  if (assignmentsError) throw new Error(assignmentsError.message);
  if ((assignments ?? []).length > 0) {
    throw new Error('HAS_ASSIGNMENTS');
  }

  const { error } = await supabase
    .from('questionnaires')
    .delete()
    .eq('id', id);
  if (error) throw new Error(mapQuestionnaireError(error.message));
}

// ─── Clone (versioning, RULE-012d) ───────────────────────────────────────────

export async function cloneQuestionnaire(id: string): Promise<string> {
  const original = await fetchQuestionnaireById(id);

  const { data: cloned, error: cloneError } = await supabase
    .from('questionnaires')
    .insert({
      name:                original.name,
      category_id:         original.category_id,
      description:         original.description,
      status:              'DRAFT',
      version:             original.version + 1,
      parent_id:           original.parent_id ?? original.id,
      intervention_matrix: original.intervention_matrix,
      scoring_config:      original.scoring_config,
    })
    .select('id')
    .single();
  if (cloneError) throw new Error(cloneError.message);

  const newId = str(cloned.id);
  if (original.sections.length > 0) {
    // Fresh ids for the clone's sections/questions, with skip_logic targets
    // remapped so they keep pointing within the clone (not the original).
    const idMap = new Map<string, string>();
    for (const section of original.sections) {
      idMap.set(section.id, crypto.randomUUID());
      for (const question of section.questions) idMap.set(question.id, crypto.randomUUID());
    }

    const remappedSections = original.sections.map((section) => ({
      ...section,
      id: idMap.get(section.id)!,
      questionnaire_id: newId,
      questions: section.questions.map((q) => ({
        ...q,
        id: idMap.get(q.id)!,
        section_id: idMap.get(section.id)!,
        skip_logic: q.skip_logic.map((rule) => ({
          ...rule,
          target_id: idMap.get(rule.target_id) ?? rule.target_id,
        })),
      })),
    }));

    await saveQuestionnaireStructure(newId, remappedSections);
  }
  return newId;
}
