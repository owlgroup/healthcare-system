/**
 * FR-013: Questionnaire Assignment API
 */

import { supabase } from '@/lib/supabase';
import type { QuestionnaireAnswerPayload } from '@/lib/questionnaire-scoring';

export type QuestionnaireAssignment = {
  id: string;
  questionnaire_id: string;
  appointment_id: string | null;
  patient_id: string;
  assigned_by: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  due_at: string | null;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined
  questionnaire_name?: string;
  questionnaire_category?: string;
};

export type QuestionnaireAssignmentWithResponse = QuestionnaireAssignment & {
  total_score?: number | null;
  score_label?: string | null;
  intervention?: string | null;
  submitted_at?: string | null;
};

/**
 * Assign a questionnaire to a patient (by doctor/admin)
 */
export async function assignQuestionnaire(params: {
  questionnaireId: string;
  patientId: string;
  appointmentId?: string;
  dueAt?: string;
  note?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('assign_questionnaire', {
    p_questionnaire_id: params.questionnaireId,
    p_patient_id: params.patientId,
    p_appointment_id: params.appointmentId ?? null,
    p_due_at: params.dueAt ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw new Error(mapError(error.message));
  return data as string;
}

/**
 * Get all assignments for a specific appointment
 */
export async function getAssignmentsByAppointment(
  appointmentId: string
): Promise<QuestionnaireAssignmentWithResponse[]> {
  const { data, error } = await supabase
    .from('questionnaire_assignments')
    .select(`
      *,
      questionnaires ( name, question_categories ( name ) ),
      questionnaire_responses ( total_score, score_label, intervention, submitted_at )
    `)
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const q = row.questionnaires as Record<string, unknown> | null;
    const cat = q?.question_categories as { name: string } | { name: string }[] | null;
    const catRow = Array.isArray(cat) ? cat[0] : cat;
    const resp = Array.isArray(row.questionnaire_responses)
      ? (row.questionnaire_responses as Record<string, unknown>[])[0]
      : null;

    return {
      id: String(row.id),
      questionnaire_id: String(row.questionnaire_id),
      appointment_id: row.appointment_id ? String(row.appointment_id) : null,
      patient_id: String(row.patient_id),
      assigned_by: String(row.assigned_by),
      status: row.status as QuestionnaireAssignment['status'],
      due_at: row.due_at ? String(row.due_at) : null,
      completed_at: row.completed_at ? String(row.completed_at) : null,
      note: row.note ? String(row.note) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      questionnaire_name: q?.name ? String(q.name) : undefined,
      questionnaire_category: catRow?.name ? String(catRow.name) : undefined,
      total_score: resp?.total_score != null ? Number(resp.total_score) : null,
      score_label: resp?.score_label ? String(resp.score_label) : null,
      intervention: resp?.intervention ? String(resp.intervention) : null,
      submitted_at: resp?.submitted_at ? String(resp.submitted_at) : null,
    };
  });
}

/**
 * Get all pending assignments for a patient (patient portal)
 */
export async function getMyPendingAssignments(): Promise<QuestionnaireAssignmentWithResponse[]> {
  const { data, error } = await supabase
    .from('questionnaire_assignments')
    .select(`
      *,
      questionnaires ( name ),
      questionnaire_responses ( total_score, score_label, submitted_at )
    `)
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const q = row.questionnaires as Record<string, unknown> | null;
    const resp = Array.isArray(row.questionnaire_responses)
      ? (row.questionnaire_responses as Record<string, unknown>[])[0]
      : null;
    return {
      id: String(row.id),
      questionnaire_id: String(row.questionnaire_id),
      appointment_id: row.appointment_id ? String(row.appointment_id) : null,
      patient_id: String(row.patient_id),
      assigned_by: String(row.assigned_by),
      status: row.status as QuestionnaireAssignment['status'],
      due_at: row.due_at ? String(row.due_at) : null,
      completed_at: row.completed_at ? String(row.completed_at) : null,
      note: row.note ? String(row.note) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      questionnaire_name: q?.name ? String(q.name) : undefined,
      total_score: resp?.total_score != null ? Number(resp.total_score) : null,
      score_label: resp?.score_label ? String(resp.score_label) : null,
      submitted_at: resp?.submitted_at ? String(resp.submitted_at) : null,
    };
  });
}

export async function submitQuestionnaireResponse(
  assignmentId: string,
  answers: QuestionnaireAnswerPayload[],
): Promise<string> {
  const payload = answers.map((a) => ({
    question_id: a.question_id,
    answer_value: a.answer_value,
    score_value: a.score_value,
  }));

  const { data, error } = await supabase.rpc('submit_questionnaire_response', {
    p_assignment_id: assignmentId,
    p_answers: payload,
  });

  if (error) throw new Error(mapError(error.message));
  return data as string;
}

export async function getAssignmentAnswers(assignmentId: string): Promise<Record<string, string | string[] | number>> {
  const { data: response, error: respErr } = await supabase
    .from('questionnaire_responses')
    .select('id')
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (respErr) throw new Error(respErr.message);
  if (!response) return {};

  const { data: rows, error } = await supabase
    .from('questionnaire_answers')
    .select('question_id, answer_value')
    .eq('response_id', response.id);

  if (error) throw new Error(error.message);

  const out: Record<string, string | string[] | number> = {};
  for (const row of rows ?? []) {
    const qid = String(row.question_id);
    const val = row.answer_value;
    if (typeof val === 'number') out[qid] = val;
    else if (Array.isArray(val)) out[qid] = val.map(String);
    else if (typeof val === 'string') out[qid] = val;
    else if (val != null) out[qid] = String(val);
  }
  return out;
}

function mapError(message: string): string {
  if (message.includes('UNAUTHORIZED')) return 'Bạn không có quyền thực hiện thao tác này.';
  if (message.includes('NOT_FOUND')) return 'Không tìm thấy bảng câu hỏi.';
  if (message.includes('ALREADY_SUBMITTED')) return 'Bảng câu hỏi này đã được gửi.';
  return message;
}
