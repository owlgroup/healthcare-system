/**
 * FR-010 / FR-011: EMR API — SOAP Note CRUD and Doctor Sign-off
 */

import { supabase } from '@/lib/supabase';
import { analyzeTranscript, suggestIcd10 } from '@/lib/stt-nlp-api';
import { decrypt, encrypt } from '@/lib/crypto';
import { formatPinInvalidMessage } from '@/lib/pin-attempts';
import {
  toExamActivityLogEntry,
  type ExamActivityAction,
  type ExamActivityLogEntry,
  type SoapNoteSnapshot,
  type SoapChangedField,
} from '@/lib/exam-activity-log';
import type { AiAccuracyDoctorRow, AiAccuracySoapRow } from '@/lib/ai-accuracy-stats';
import {
  SOAP_ASSESSMENT_REQUIRED_MESSAGE,
  PIN_SIGN_LOCK_MESSAGE,
  type MedicalExamination,
  type SoapIcdCode,
  type IcdConfirmStatus,
  type SignExaminationResult,
  type AiIcdSuggestion,
} from '@/types/emr';

// Helper to decrypt SOAP fields
async function decryptSoapFields(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decrypted = { ...row };
  for (const field of ['s_text', 'o_text', 'a_text', 'p_text']) {
    const value = row[field];
    if (value && typeof value === 'string') {
      decrypted[field] = await decrypt(value);
    }
  }
  return decrypted;
}

// Helper to encrypt SOAP fields before saving
async function encryptSoapFields(fields: {
  s_text?: string;
  o_text?: string;
  a_text?: string;
  p_text?: string;
}): Promise<typeof fields> {
  const encrypted: typeof fields = {};
  if (fields.s_text) encrypted.s_text = await encrypt(fields.s_text);
  if (fields.o_text) encrypted.o_text = await encrypt(fields.o_text);
  if (fields.a_text) encrypted.a_text = await encrypt(fields.a_text);
  if (fields.p_text) encrypted.p_text = await encrypt(fields.p_text);
  return encrypted;
}

async function decryptSoapSnapshot(raw: unknown): Promise<SoapNoteSnapshot | null> {
  if (raw == null) return null;
  let parsed: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  }
  if (!parsed) return null;
  const decrypted = await decryptSoapFields(parsed);
  return {
    s_text: decrypted.s_text != null ? String(decrypted.s_text) : null,
    o_text: decrypted.o_text != null ? String(decrypted.o_text) : null,
    a_text: decrypted.a_text != null ? String(decrypted.a_text) : null,
    p_text: decrypted.p_text != null ? String(decrypted.p_text) : null,
  };
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function mapIcdRow(row: Record<string, unknown>): SoapIcdCode {
  return {
    id: String(row.id),
    exam_id: String(row.exam_id),
    icd_code: String(row.icd_code),
    icd_name: String(row.icd_name),
    is_ai_suggested: Boolean(row.is_ai_suggested),
    ai_confidence: row.ai_confidence != null ? Number(row.ai_confidence) : null,
    ai_reason: row.ai_reason != null ? String(row.ai_reason) : null,
    confirm_status: row.confirm_status as IcdConfirmStatus,
    confirmed_at: row.confirmed_at != null ? String(row.confirmed_at) : null,
    display_order: Number(row.display_order ?? 0),
    created_at: String(row.created_at),
  };
}

async function mapExamRow(row: Record<string, unknown>): Promise<MedicalExamination> {
  // Decrypt SOAP fields
  const decrypted = await decryptSoapFields(row);

  const rawIcds = decrypted.icd_codes;
  let icdCodes: SoapIcdCode[] = [];
  if (Array.isArray(rawIcds)) {
    icdCodes = rawIcds.map((i) => mapIcdRow(i as Record<string, unknown>));
  } else if (typeof rawIcds === 'string') {
    try {
      const parsed = JSON.parse(rawIcds);
      if (Array.isArray(parsed)) {
        icdCodes = parsed.map((i) => mapIcdRow(i as Record<string, unknown>));
      }
    } catch {
      // ignore
    }
  }

  return {
    id: String(decrypted.id),
    appointment_id: String(decrypted.appointment_id),
    patient_id: String(decrypted.patient_id),
    doctor_id: String(decrypted.doctor_id),
    s_text: decrypted.s_text != null ? String(decrypted.s_text) : null,
    o_text: decrypted.o_text != null ? String(decrypted.o_text) : null,
    a_text: decrypted.a_text != null ? String(decrypted.a_text) : null,
    p_text: decrypted.p_text != null ? String(decrypted.p_text) : null,
    status: decrypted.status as MedicalExamination['status'],
    is_addendum: Boolean(decrypted.is_addendum),
    parent_exam_id: decrypted.parent_exam_id != null ? String(decrypted.parent_exam_id) : null,
    amendment_reason: decrypted.amendment_reason != null ? String(decrypted.amendment_reason) : null,
    auto_saved_at: decrypted.auto_saved_at != null ? String(decrypted.auto_saved_at) : null,
    created_at: String(decrypted.created_at),
    updated_at: String(decrypted.updated_at),
    ai_baseline: await decryptSoapSnapshot(decrypted.ai_baseline ?? row.ai_baseline),
    icd_codes: icdCodes,
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Creates or retrieves an existing DRAFT examination for an appointment
 * Idempotent — safe to call multiple times
 */
export async function createOrGetExamination(appointmentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_or_get_examination', {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(mapEmrError(error.message));
  return data as string;
}

/** Load an existing SOAP first so completed/signed exams skip create_or_get. */
export async function resolveExaminationId(appointmentId: string): Promise<string> {
  const existing = await getExaminationByAppointment(appointmentId);
  if (existing) return existing.id;
  return createOrGetExamination(appointmentId);
}

/**
 * Loads a full SOAP note (with ICD codes) by appointment ID
 */
export async function getExaminationByAppointment(
  appointmentId: string
): Promise<MedicalExamination | null> {
  const { data, error } = await supabase.rpc('get_examination_for_doctor', {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(mapEmrError(error.message));
  const rows = data as Record<string, unknown>[] | null;
  if (!rows || rows.length === 0) return null;
  return await mapExamRow(rows[0]);
}

export async function getExaminationById(
  examId: string
): Promise<MedicalExamination | null> {
  const { data, error } = await supabase
    .from('medical_examinations')
    .select('*, soap_icd_codes(*)')
    .eq('id', examId)
    .maybeSingle();
  if (error) throw new Error(mapEmrError(error.message));
  if (!data) return null;
  const [exam] = await mapExamRowsWithIcds([data as Record<string, unknown>]);
  return exam;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mapExamRowsWithIcds(
  rows: Record<string, unknown>[],
): Promise<MedicalExamination[]> {
  return Promise.all(
    rows.map((row) => {
      const embedded = row.soap_icd_codes;
      const icd_codes = Array.isArray(embedded)
        ? embedded.map((item) => ({
            ...(item as Record<string, unknown>),
            exam_id: row.id,
          }))
        : row.icd_codes;
      return mapExamRow({ ...row, icd_codes });
    }),
  );
}

/**
 * Locked SOAP notes for a patient (auth user id and/or profile id).
 */
export async function listLockedExaminationsForPatient(ids: {
  patientUserId?: string | null;
  profileId?: string | null;
}): Promise<MedicalExamination[]> {
  const userId = ids.patientUserId && UUID_RE.test(ids.patientUserId) ? ids.patientUserId : null;
  const profileId = ids.profileId && UUID_RE.test(ids.profileId) ? ids.profileId : null;
  if (!userId && !profileId) return [];

  const byId = new Map<string, MedicalExamination>();

  if (userId) {
    const { data, error } = await supabase
      .from('medical_examinations')
      .select('*, soap_icd_codes(*)')
      .eq('patient_id', userId)
      .eq('status', 'LOCKED');
    if (error) throw new Error(mapEmrError(error.message));
    for (const exam of await mapExamRowsWithIcds((data ?? []) as Record<string, unknown>[])) {
      byId.set(exam.id, exam);
    }
  }

  if (profileId) {
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id')
      .eq('profile_id', profileId);
    if (apptErr) throw new Error(mapEmrError(apptErr.message));
    const appointmentIds = (appts ?? []).map((row) => String(row.id)).filter((id) => UUID_RE.test(id));
    if (appointmentIds.length > 0) {
      const { data, error } = await supabase
        .from('medical_examinations')
        .select('*, soap_icd_codes(*)')
        .in('appointment_id', appointmentIds)
        .eq('status', 'LOCKED');
      if (error) throw new Error(mapEmrError(error.message));
      for (const exam of await mapExamRowsWithIcds((data ?? []) as Record<string, unknown>[])) {
        byId.set(exam.id, exam);
      }
    }
  }

  return [...byId.values()];
}

/**
 * Auto-saves or manually saves SOAP draft fields
 * RULE-010c: s_text must not be empty if provided
 */
export async function saveSoapDraft(
  examId: string,
  fields: {
    s_text?: string;
    o_text?: string;
    a_text?: string;
    p_text?: string;
  },
  options?: { manual?: boolean; changedFields?: string[] }
): Promise<string> {
  // Encrypt SOAP fields before saving
  const encrypted = await encryptSoapFields(fields);

  const { data, error } = await supabase.rpc('save_soap_draft', {
    p_exam_id: examId,
    p_s_text: encrypted.s_text ?? null,
    p_o_text: encrypted.o_text ?? null,
    p_a_text: encrypted.a_text ?? null,
    p_p_text: encrypted.p_text ?? null,
    p_manual: options?.manual ?? false,
    p_changed_fields: options?.changedFields ?? [],
  });
  if (error) throw new Error(mapEmrError(error.message));
  return data as string;
}

export async function listExaminationActivityLog(
  examId: string
): Promise<ExamActivityLogEntry[]> {
  const { data, error } = await supabase.rpc('list_examination_activity_log', {
    p_exam_id: examId,
  });
  if (error) throw new Error(mapEmrError(error.message));
  return ((data ?? []) as Array<{
    id: string;
    exam_id: string;
    actor_id: string | null;
    actor_name: string | null;
    action: ExamActivityAction;
    created_at: string;
    changed_fields?: unknown;
    related_exam_id?: string | null;
  }>).map(toExamActivityLogEntry);
}

export type ExamVersionHistoryEntry = {
  id: string;
  version: number;
  action: ExamActivityAction;
  actor_name: string | null;
  created_at: string;
  changed_fields: SoapChangedField[];
  soap_snapshot: SoapNoteSnapshot | null;
  is_current: boolean;
  related_exam_id: string | null;
  addendum_reason: string | null;
  addendum_soap_snapshot: SoapNoteSnapshot | null;
};

export async function getExaminationVersionHistory(
  examId: string
): Promise<ExamVersionHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_examination_version_history', {
    p_exam_id: examId,
  });
  if (error) throw new Error(mapEmrError(error.message));

  const rows = (data ?? []) as Array<{
    id: string;
    version: number;
    action: string;
    actor_name: string | null;
    created_at: string;
    changed_fields: string[] | null;
    soap_snapshot: unknown;
    is_current: boolean;
    related_exam_id: string | null;
    addendum_reason: string | null;
    addendum_soap_snapshot: unknown;
  }>;

  const results: ExamVersionHistoryEntry[] = [];
  for (const row of rows) {
    const soapSnapshot = await decryptSoapSnapshot(row.soap_snapshot);
    const addendumSoapSnapshot = row.addendum_soap_snapshot
      ? await decryptSoapSnapshot(row.addendum_soap_snapshot)
      : null;
    results.push({
      id: row.id,
      version: row.version,
      action: row.action as ExamActivityAction,
      actor_name: row.actor_name,
      created_at: row.created_at,
      changed_fields: (row.changed_fields ?? []) as SoapChangedField[],
      soap_snapshot: soapSnapshot,
      is_current: row.is_current,
      related_exam_id: row.related_exam_id ?? null,
      addendum_reason: row.addendum_reason ?? null,
      addendum_soap_snapshot: addendumSoapSnapshot,
    });
  }
  return results;
}

export async function listExamAddenda(parentExamId: string): Promise<MedicalExamination[]> {
  const { data, error } = await supabase.rpc('list_exam_addenda', {
    p_parent_exam_id: parentExamId,
  });
  if (error) throw new Error(mapEmrError(error.message));
  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(rows.map((row) => mapExamRow(row)));
}

/**
 * Add or update an ICD code on the SOAP note
 */
export async function upsertIcdCode(params: {
  examId: string;
  icdCode: string;
  icdName: string;
  isAiSuggested?: boolean;
  aiConfidence?: number | null;
  aiReason?: string | null;
  confirmStatus?: IcdConfirmStatus;
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_icd_code', {
    p_exam_id: params.examId,
    p_icd_code: params.icdCode,
    p_icd_name: params.icdName,
    p_is_ai_suggested: params.isAiSuggested ?? false,
    p_ai_confidence: params.aiConfidence ?? null,
    p_ai_reason: params.aiReason ?? null,
    p_confirm_status: params.confirmStatus ?? 'PENDING',
  });
  if (error) throw new Error(mapEmrError(error.message));
  return data as string;
}

/**
 * Confirm an ICD code (doctor manual confirmation)
 */
export async function confirmIcdCode(examId: string, icdCode: string, icdName: string): Promise<void> {
  await upsertIcdCode({
    examId,
    icdCode,
    icdName,
    confirmStatus: 'CONFIRMED',
  });
}

/**
 * Reject an AI-suggested ICD code
 */
export async function rejectIcdCode(examId: string, icdCode: string, icdName: string): Promise<void> {
  await upsertIcdCode({
    examId,
    icdCode,
    icdName,
    confirmStatus: 'REJECTED',
  });
}

/**
 * Remove an ICD code from a SOAP note
 */
export async function removeIcdCode(icdId: string): Promise<void> {
  const { error } = await supabase
    .from('soap_icd_codes')
    .delete()
    .eq('id', icdId);
  if (error) throw new Error(error.message);
}

/**
 * Set/update doctor's sign-off PIN (syncs hash + profile plain PIN).
 */
export async function setDoctorPin(pinPlain: string): Promise<void> {
  const { error } = await supabase.rpc('set_doctor_pin', {
    p_pin_plain: pinPlain,
  });
  if (error) throw new Error(mapEmrError(error.message));
}

/**
 * Check if the current doctor has set a PIN
 */
export async function checkDoctorPinSet(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_doctor_pin_set');
  if (error) return false;
  return Boolean(data);
}

/**
 * Sign (lock) an examination with doctor PIN verification (RULE-011).
 */
export async function signExamination(params: {
  examId: string;
  pinPlain: string | null;
  responsibilityAck: boolean;
}): Promise<SignExaminationResult> {
  const { data, error } = await supabase.rpc('sign_examination', {
    p_exam_id: params.examId,
    p_pin_plain: params.pinPlain?.trim() || null,
    p_responsibility_ack: params.responsibilityAck,
    p_ip_address: null,
    p_user_agent: navigator.userAgent,
  });

  if (error) throw new Error(mapEmrError(error.message));

  const rows = data as {
    exam_id: string | null;
    sig_id: string | null;
    data_hash: string | null;
    error_code?: string | null;
    attempts_remaining?: number | null;
  }[] | null;
  if (!rows || rows.length === 0) throw new Error('Không nhận được kết quả ký');

  const row = rows[0];
  if (row.error_code) {
    if (row.error_code === 'PIN_INVALID' && row.attempts_remaining != null) {
      throw new Error(formatPinInvalidMessage(Number(row.attempts_remaining)));
    }
    throw new Error(mapEmrError(row.error_code));
  }

  if (!row.exam_id || !row.sig_id || !row.data_hash) {
    throw new Error('Không nhận được kết quả ký');
  }

  return {
    exam_id: String(row.exam_id),
    sig_id: String(row.sig_id),
    data_hash: String(row.data_hash),
  };
}

export type Icd10SearchResult = {
  code: string;
  name: string;
  confidence?: number;
  evidence?: string;
};

/**
 * Search ICD-10 via Module 5/6 /icd10/rag API (primary), DB fallback when offline.
 */
export async function searchIcd10(query: string): Promise<Icd10SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  try {
    const result = await suggestIcd10({
      recentTranscript: q,
      complaints: [q],
    });

    const fromApi = (result.icd10 ?? []).map((item) => ({
      code: item.code,
      name: item.name_vi || item.name_en || item.code,
      confidence: item.confidence,
      evidence: item.evidence,
    }));

    if (fromApi.length > 0) {
      return fromApi.slice(0, 20);
    }
  } catch {
    // Fall through to local DB / static list
  }

  return searchIcd10Local(q);
}

async function searchIcd10Local(query: string): Promise<Icd10SearchResult[]> {
  const { data, error } = await supabase
    .from('icd10_codes')
    .select('code, name')
    .or(`code.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(20);

  if (error) {
    return searchIcd10Fallback(query);
  }

  return (data ?? []).map((row) => ({
    code: String((row as Record<string, unknown>).code),
    name: String((row as Record<string, unknown>).name),
  }));
}

/**
 * AI ICD-10 suggestions via Module 5/6 backend (/icd10/rag)
 */
export async function getAiIcdSuggestions(
  sText: string,
  oText: string
): Promise<AiIcdSuggestion[]> {
  const combinedText = `${sText} ${oText}`.trim();
  const totalLength = combinedText.length;

  // Minimum content threshold
  if (totalLength < 30) return [];

  const cacheKey = hashIcdCacheKey(sText, oText);
  const cached = await getCachedIcdSuggestions(cacheKey);
  if (cached && cached.length > 0) return cached;

  try {
    const analysis = await analyzeTranscript(combinedText);
    const complaints = analysis.complaints.map((c) => c.text);
    const symptomsPresent = analysis.symptoms_present.map((s) => s.text);
    const symptomsDenied = analysis.symptoms_denied.map((s) => s.text);

    const result = await suggestIcd10({
      complaints,
      symptomsPresent,
      symptomsDenied,
      recentTranscript: combinedText,
    });

    const fromApi = (result.icd10 ?? []).map((item) => ({
      icd_code: item.code,
      icd_name: item.name_vi || item.name_en || item.code,
      confidence: item.confidence,
      reason: item.evidence ?? result.summary ?? 'Gợi ý từ AI ICD-10',
    }));

    if (fromApi.length > 0) {
      const sorted = fromApi.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
      void setCachedIcdSuggestions(cacheKey, sorted);
      return sorted;
    }
  } catch {
    // Fall back to keyword matching when STT API is unavailable
  }

  const combined = combinedText.toLowerCase();
  const suggestions: AiIcdSuggestion[] = [];

  if (/ho|cough|sốt|fever|đau họng|throat|hô hấp|respiratory|viêm mũi|mũi/i.test(combined)) {
    suggestions.push({
      icd_code: 'J06.9',
      icd_name: 'Nhiễm khuẩn hô hấp trên cấp tính, không đặc hiệu',
      confidence: 85,
      reason: 'Triệu chứng đường hô hấp trên được phát hiện',
    });
    if (/sốt|fever|38|39/i.test(combined)) {
      suggestions.push({
        icd_code: 'J00',
        icd_name: 'Viêm mũi họng cấp (Cảm lạnh thông thường)',
        confidence: 72,
        reason: 'Sốt kèm triệu chứng hô hấp',
      });
    }
  }

  if (/đau đầu|headache|chóng mặt|dizziness|đau nửa đầu|migraine/i.test(combined)) {
    suggestions.push({
      icd_code: 'G43.9',
      icd_name: 'Đau nửa đầu (migraine), không đặc hiệu',
      confidence: 78,
      reason: 'Mô tả đau đầu, chóng mặt',
    });
  }

  if (/tiểu đường|diabetes|đường huyết|blood sugar|insulin/i.test(combined)) {
    suggestions.push({
      icd_code: 'E11.9',
      icd_name: 'Đái tháo đường týp 2, không biến chứng',
      confidence: 88,
      reason: 'Từ khóa liên quan đái tháo đường được phát hiện',
    });
  }

  if (/huyết áp|hypertension|cao áp|blood pressure|140|150|160/i.test(combined)) {
    suggestions.push({
      icd_code: 'I10',
      icd_name: 'Tăng huyết áp nguyên phát',
      confidence: 82,
      reason: 'Đề cập đến huyết áp cao',
    });
  }

  if (/đau bụng|abdominal|dạ dày|stomach|tiêu hóa|gastric|buồn nôn|nausea|nôn|vomit/i.test(combined)) {
    suggestions.push({
      icd_code: 'K30',
      icd_name: 'Khó tiêu chức năng',
      confidence: 70,
      reason: 'Triệu chứng tiêu hóa được phát hiện',
    });
  }

  if (/đau ngực|chest pain|tim|cardiac|nhịp tim|palpitation|hồi hộp/i.test(combined)) {
    suggestions.push({
      icd_code: 'R07.9',
      icd_name: 'Đau ngực, không đặc hiệu',
      confidence: 75,
      reason: 'Mô tả đau ngực hoặc triệu chứng tim mạch',
    });
  }

  if (/khớp|joint|xương|bone|viêm khớp|arthritis|đau lưng|back pain/i.test(combined)) {
    suggestions.push({
      icd_code: 'M54.5',
      icd_name: 'Đau thắt lưng',
      confidence: 74,
      reason: 'Triệu chứng cơ xương khớp',
    });
  }

  if (/da|skin|ngứa|itching|nổi mẩn|rash|dị ứng/i.test(combined)) {
    suggestions.push({
      icd_code: 'L29.9',
      icd_name: 'Ngứa da, không đặc hiệu',
      confidence: 65,
      reason: 'Triệu chứng da liễu',
    });
  }

  // Sort by confidence descending, limit to top 5 (FR-015)
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ─── Fallback ICD-10 search (if no icd10_codes table) ────────────────────────

function searchIcd10Fallback(query: string): { code: string; name: string }[] {
  const ICD10_COMMON = [
    { code: 'J06.9', name: 'Nhiễm khuẩn hô hấp trên cấp tính, không đặc hiệu' },
    { code: 'J00', name: 'Viêm mũi họng cấp (Cảm lạnh thông thường)' },
    { code: 'J18.9', name: 'Viêm phổi, không đặc hiệu' },
    { code: 'J45.9', name: 'Hen phế quản, không đặc hiệu' },
    { code: 'I10', name: 'Tăng huyết áp nguyên phát' },
    { code: 'I25.9', name: 'Bệnh tim do thiếu máu cục bộ mạn tính, không đặc hiệu' },
    { code: 'E11.9', name: 'Đái tháo đường týp 2, không biến chứng' },
    { code: 'E10.9', name: 'Đái tháo đường týp 1, không biến chứng' },
    { code: 'K30', name: 'Khó tiêu chức năng' },
    { code: 'K21.0', name: 'Bệnh trào ngược dạ dày thực quản với viêm thực quản' },
    { code: 'K59.0', name: 'Táo bón' },
    { code: 'K58.9', name: 'Hội chứng ruột kích thích, không có tiêu chảy' },
    { code: 'G43.9', name: 'Đau nửa đầu (migraine), không đặc hiệu' },
    { code: 'G44.2', name: 'Đau đầu do căng thẳng, không đặc hiệu' },
    { code: 'M54.5', name: 'Đau thắt lưng' },
    { code: 'M79.3', name: 'Viêm gân, không đặc hiệu' },
    { code: 'F32.9', name: 'Giai đoạn trầm cảm, không đặc hiệu' },
    { code: 'F41.1', name: 'Rối loạn lo âu lan tỏa' },
    { code: 'L29.9', name: 'Ngứa da, không đặc hiệu' },
    { code: 'R07.9', name: 'Đau ngực, không đặc hiệu' },
    { code: 'R51', name: 'Đau đầu' },
    { code: 'R05', name: 'Ho' },
    { code: 'R50.9', name: 'Sốt, không đặc hiệu' },
    { code: 'Z00.0', name: 'Khám sức khỏe tổng quát định kỳ' },
  ];

  const q = query.toLowerCase();
  return ICD10_COMMON.filter(
    (item) => item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
  ).slice(0, 10);
}

// ─── Error Mapping ────────────────────────────────────────────────────────────

function mapEmrError(message: string): string {
  if (message.includes('UNAUTHORIZED')) return 'Bạn không có quyền thực hiện thao tác này.';
  if (message.includes('APPOINTMENT_NOT_FOUND')) return 'Không tìm thấy lịch hẹn.';
  if (message.includes('INVALID_APPOINTMENT_STATUS'))
    return 'Chỉ có thể mở hồ sơ khám cho BN đã tiếp nhận hoặc đang khám.';
  if (message.includes('NOT_FOUND')) return 'Không tìm thấy hồ sơ khám.';
  if (message.includes('EXAM_LOCKED')) return 'Hồ sơ đã được ký, không thể chỉnh sửa.';
  if (message.includes('ALREADY_SIGNED')) return 'Hồ sơ này đã được ký trước đó.';
  if (message.includes('NO_CONFIRMED_ICD'))
    return 'Cần ít nhất 1 chẩn đoán ICD-10 được xác nhận trước khi ký.';
  if (message.includes('PIN_NOT_SET'))
    return 'Bạn chưa thiết lập mã PIN. Vui lòng vào Cài đặt để thiết lập PIN ký duyệt.';
  if (message.includes('PIN_FAILED_LOCKED') || message.includes('PIN_LOCKED'))
    return PIN_SIGN_LOCK_MESSAGE;
  if (message.includes('PIN_INVALID')) {
    const match = message.match(/(\d+) attempts remaining/);
    const remaining = match ? Number(match[1]) : null;
    return remaining != null
      ? formatPinInvalidMessage(remaining)
      : 'Mã PIN không đúng.';
  }
  if (message.includes('RESPONSIBILITY_NOT_ACKNOWLEDGED'))
    return 'Bạn phải xác nhận trách nhiệm trước khi ký.';
  if (message.includes('VALIDATION_ERROR: s_text'))
    return 'Phần Subjective (S) là bắt buộc.';
  if (message.includes('VALIDATION_ERROR: Assessment (A)'))
    return SOAP_ASSESSMENT_REQUIRED_MESSAGE;
  if (message.includes('REASON_REQUIRED'))
    return 'Vui lòng nhập lý do xác nhận trước khi tạo phiếu bổ sung.';
  if (message.includes('medical_examinations_appointment_id_key'))
    return 'Không tạo được phiếu bổ sung cho lịch hẹn này.';
  if (message.includes('digest('))
    return 'Không tạo được phiếu bổ sung (lỗi mã hóa chữ ký).';
  return message;
}

// ─── UAT gap closure APIs ─────────────────────────────────────────────────────

export type IntegrityResult = {
  valid: boolean;
  reason?: string;
  message: string;
  stored_hash?: string;
  computed_hash?: string;
  signed_at?: string;
};

export async function verifyExaminationIntegrity(examId: string): Promise<IntegrityResult> {
  const { data, error } = await supabase.rpc('verify_examination_integrity', {
    p_exam_id: examId,
  });
  if (error) throw new Error(mapEmrError(error.message));
  return data as IntegrityResult;
}

export async function createExamAddendum(
  parentExamId: string,
  fields: { s_text?: string; o_text?: string; a_text?: string; p_text?: string; reason: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_exam_addendum', {
    p_parent_exam_id: parentExamId,
    p_s_text: fields.s_text ?? null,
    p_o_text: fields.o_text ?? null,
    p_a_text: fields.a_text ?? null,
    p_p_text: fields.p_text ?? null,
    p_reason: fields.reason,
  });
  if (error) throw new Error(mapEmrError(error.message));
  return data as string;
}

/**
 * Sign (lock) an addendum with doctor PIN verification (TC-DLS-016).
 */
export async function signAddendum(params: {
  addendumId: string;
  pinPlain: string;
  responsibilityAck: boolean;
}): Promise<SignExaminationResult> {
  const { data, error } = await supabase.rpc('sign_exam_addendum', {
    p_addendum_id: params.addendumId,
    p_pin_plain: params.pinPlain?.trim() || null,
    p_responsibility_ack: params.responsibilityAck,
    p_ip_address: null,
    p_user_agent: navigator.userAgent,
  });

  if (error) throw new Error(mapEmrError(error.message));

  const rows = data as {
    addendum_id: string | null;
    sig_id: string | null;
    data_hash: string | null;
    error_code?: string | null;
    attempts_remaining?: number | null;
  }[] | null;

  if (!rows || rows.length === 0) throw new Error('Không nhận được kết quả ký');

  const row = rows[0];
  if (row.error_code) {
    if (row.error_code === 'PIN_INVALID' && row.attempts_remaining != null) {
      throw new Error(formatPinInvalidMessage(Number(row.attempts_remaining)));
    }
    throw new Error(mapEmrError(row.error_code));
  }

  if (!row.addendum_id || !row.sig_id || !row.data_hash) {
    throw new Error('Không nhận được kết quả ký');
  }

  return {
    exam_id: String(row.addendum_id),
    sig_id: String(row.sig_id),
    data_hash: String(row.data_hash),
  };
}

export async function saveSoapAiBaseline(
  examId: string,
  baseline: { s_text: string; o_text: string; a_text: string; p_text: string }
): Promise<void> {
  const encrypted = await encryptSoapFields(baseline);
  const { error } = await supabase.rpc('save_soap_ai_baseline', {
    p_exam_id: examId,
    p_baseline: encrypted,
  });
  if (error) throw new Error(error.message);
}

export type AiAccuracyStats = {
  total_signed_with_ai: number;
  doctor_edited_count: number;
  avg_ai_retention_pct: number;
  edit_rate_pct: number;
  by_soap: AiAccuracySoapRow[];
  by_doctor: AiAccuracyDoctorRow[];
};

export type AiAccuracyStatsFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  specialtyId?: string | null;
};

export async function getAiAccuracyStats(
  filters: AiAccuracyStatsFilters = {},
): Promise<AiAccuracyStats> {
  const { data, error } = await supabase.rpc("get_ai_accuracy_stats", {
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_specialty_id: filters.specialtyId || null,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as Partial<AiAccuracyStats>;
  return {
    total_signed_with_ai: Number(payload.total_signed_with_ai ?? 0),
    doctor_edited_count: Number(payload.doctor_edited_count ?? 0),
    avg_ai_retention_pct: Number(payload.avg_ai_retention_pct ?? 0),
    edit_rate_pct: Number(payload.edit_rate_pct ?? 0),
    by_soap: payload.by_soap ?? [],
    by_doctor: payload.by_doctor ?? [],
  };
}

function hashIcdCacheKey(sText: string, oText: string): string {
  const normalized = `${sText.trim()}|${oText.trim()}`.toLowerCase().slice(0, 500);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `icd_${Math.abs(hash)}`;
}

async function getCachedIcdSuggestions(key: string): Promise<AiIcdSuggestion[] | null> {
  const { data } = await supabase.rpc('get_cached_icd_suggestions', { p_cache_key: key });
  if (!data) return null;
  return data as AiIcdSuggestion[];
}

async function setCachedIcdSuggestions(key: string, suggestions: AiIcdSuggestion[]): Promise<void> {
  await supabase.rpc('set_cached_icd_suggestions', {
    p_cache_key: key,
    p_suggestions: suggestions,
  });
}
