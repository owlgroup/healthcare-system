/**
 * FR-022: Pre-Consultation Health Declaration API
 * CRUD operations for pre-consultation forms
 */

import { supabase } from '@/lib/supabase';
import { decrypt, encrypt } from '@/lib/crypto';

// Pre-consultation sensitive fields
const PRE_CONSULT_SENSITIVE_FIELDS = [
  'chief_complaint',
  'surgical_history',
  'otc_supplements',
  'smoking_frequency',
  'alcohol_frequency',
] as const;

async function decryptPreConsultFields(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decrypted = { ...row };
  for (const field of PRE_CONSULT_SENSITIVE_FIELDS) {
    const value = row[field];
    if (value && typeof value === 'string') {
      decrypted[field] = await decrypt(value);
    }
  }
  return decrypted;
}

async function encryptPreConsultFields(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const encrypted = { ...input };
  for (const field of PRE_CONSULT_SENSITIVE_FIELDS) {
    const value = input[field];
    if (value && typeof value === 'string') {
      encrypted[field] = await encrypt(value);
    }
  }
  return encrypted;
}
import type {
  PreConsultation,
  DoctorPreConsultation,
  PreConsultationBundle,
  UpdatePreConsultationInput,
  UpdateDoctorPreConsultationInput,
  SubmitPreConsultationResult,
  PreConsultationFlags,
  MedicalHistoryItem,
  FamilyHistoryItem,
  MedicationItem,
  DrugAllergyItem,
  FoodAllergyItem,
  PreConsultationStatus,
  SymptomDurationUnit,
  SmokingStatus,
  AlcoholStatus,
  ExerciseStatus,
} from '@/types/pre-consultation';

// ─── Type Guards & Parsers ───────────────────────────────────────────────────

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseFlags(value: unknown): PreConsultationFlags {
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return {
      drug_allergy: Boolean(obj.drug_allergy),
      severe_pain: Boolean(obj.severe_pain),
    };
  }
  return { drug_allergy: false, severe_pain: false };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

// ─── Row Mapper ──────────────────────────────────────────────────────────────

async function mapPreConsultationRow(row: Record<string, unknown>): Promise<PreConsultation> {
  // Decrypt sensitive fields
  const decrypted = await decryptPreConsultFields(row);

  return {
    id: String(decrypted.id),
    appointment_id: String(decrypted.appointment_id),
    patient_id: String(decrypted.patient_id),
    status: decrypted.status as PreConsultationStatus,

    // Nhóm 1: Triệu chứng
    chief_complaint: decrypted.chief_complaint != null ? String(decrypted.chief_complaint) : null,
    symptom_duration: decrypted.symptom_duration != null ? Number(decrypted.symptom_duration) : null,
    symptom_duration_unit: decrypted.symptom_duration_unit as SymptomDurationUnit | null,
    symptom_onset_at: decrypted.symptom_onset_at != null ? String(decrypted.symptom_onset_at) : null,
    pain_scale: decrypted.pain_scale != null ? Number(decrypted.pain_scale) : null,
    symptom_tags: parseStringArray(decrypted.symptom_tags),

    // Nhóm 2: Bệnh sử
    medical_history: parseJsonArray<MedicalHistoryItem>(decrypted.medical_history),
    surgical_history: decrypted.surgical_history != null ? String(decrypted.surgical_history) : null,
    family_history: parseJsonArray<FamilyHistoryItem>(decrypted.family_history),

    // Nhóm 3: Thuốc
    current_medications: parseJsonArray<MedicationItem>(decrypted.current_medications),
    otc_supplements: decrypted.otc_supplements != null ? String(decrypted.otc_supplements) : null,

    // Nhóm 4: Dị ứng
    drug_allergies: parseJsonArray<DrugAllergyItem>(decrypted.drug_allergies),
    food_allergies: parseJsonArray<FoodAllergyItem>(decrypted.food_allergies),

    // Nhóm 5: Lối sống
    smoking: decrypted.smoking as SmokingStatus | null,
    smoking_frequency: decrypted.smoking_frequency != null ? String(decrypted.smoking_frequency) : null,
    alcohol: decrypted.alcohol as AlcoholStatus | null,
    alcohol_frequency: decrypted.alcohol_frequency != null ? String(decrypted.alcohol_frequency) : null,
    exercise: decrypted.exercise as ExerciseStatus | null,
    exercise_frequency: decrypted.exercise_frequency != null ? String(decrypted.exercise_frequency) : null,

    // Metadata
    flags: parseFlags(decrypted.flags),
    submitted_at: decrypted.submitted_at != null ? String(decrypted.submitted_at) : null,
    submitted_by_user_id: decrypted.submitted_by_user_id != null ? String(decrypted.submitted_by_user_id) : null,
    created_at: String(decrypted.created_at),
    updated_at: String(decrypted.updated_at),
  };
}

function mapClinicalFields(row: Record<string, unknown>) {
  return {
    chief_complaint: row.chief_complaint != null ? String(row.chief_complaint) : null,
    symptom_duration: row.symptom_duration != null ? Number(row.symptom_duration) : null,
    symptom_duration_unit: row.symptom_duration_unit as SymptomDurationUnit | null,
    symptom_onset_at: row.symptom_onset_at != null ? String(row.symptom_onset_at) : null,
    pain_scale: row.pain_scale != null ? Number(row.pain_scale) : null,
    symptom_tags: parseStringArray(row.symptom_tags),
    medical_history: parseJsonArray<MedicalHistoryItem>(row.medical_history),
    surgical_history: row.surgical_history != null ? String(row.surgical_history) : null,
    family_history: parseJsonArray<FamilyHistoryItem>(row.family_history),
    current_medications: parseJsonArray<MedicationItem>(row.current_medications),
    otc_supplements: row.otc_supplements != null ? String(row.otc_supplements) : null,
    drug_allergies: parseJsonArray<DrugAllergyItem>(row.drug_allergies),
    food_allergies: parseJsonArray<FoodAllergyItem>(row.food_allergies),
    smoking: row.smoking as SmokingStatus | null,
    smoking_frequency: row.smoking_frequency != null ? String(row.smoking_frequency) : null,
    alcohol: row.alcohol as AlcoholStatus | null,
    alcohol_frequency: row.alcohol_frequency != null ? String(row.alcohol_frequency) : null,
    exercise: row.exercise as ExerciseStatus | null,
    exercise_frequency: row.exercise_frequency != null ? String(row.exercise_frequency) : null,
    flags: parseFlags(row.flags),
  };
}

function mapDoctorPreConsultationRow(row: Record<string, unknown>): DoctorPreConsultation {
  return {
    id: String(row.id),
    appointment_id: String(row.appointment_id),
    patient_id: String(row.patient_id),
    ...mapClinicalFields(row),
    created_by_user_id: String(row.created_by_user_id),
    updated_by_user_id: String(row.updated_by_user_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function mapBundlePayload(raw: Record<string, unknown>): Promise<PreConsultationBundle> {
  const patientRaw = raw.patient as Record<string, unknown> | null;
  const doctorRaw = raw.doctor as Record<string, unknown> | null;

  return {
    patient: patientRaw ? await mapPreConsultationRow(patientRaw) : null,
    doctor: doctorRaw ? mapDoctorPreConsultationRow(doctorRaw) : null,
    patientCreatorName: raw.patient_creator_name != null ? String(raw.patient_creator_name) : null,
    doctorCreatorName: raw.doctor_creator_name != null ? String(raw.doctor_creator_name) : null,
    doctorUpdaterName: raw.doctor_updater_name != null ? String(raw.doctor_updater_name) : null,
  };
}

function buildUpdateRpcParams(input: UpdatePreConsultationInput) {
  return {
    p_chief_complaint: input.chief_complaint ?? null,
    p_symptom_duration: input.symptom_duration ?? null,
    p_symptom_duration_unit: input.symptom_duration_unit ?? null,
    p_symptom_onset_at: input.symptom_onset_at ?? null,
    p_pain_scale: input.pain_scale ?? null,
    p_symptom_tags: input.symptom_tags ?? null,
    p_medical_history: input.medical_history ?? null,
    p_surgical_history: input.surgical_history ?? null,
    p_family_history: input.family_history ?? null,
    p_current_medications: input.current_medications ?? null,
    p_otc_supplements: input.otc_supplements ?? null,
    p_drug_allergies: input.drug_allergies ?? null,
    p_food_allergies: input.food_allergies ?? null,
    p_smoking: input.smoking ?? null,
    p_smoking_frequency: input.smoking_frequency ?? null,
    p_alcohol: input.alcohol ?? null,
    p_alcohol_frequency: input.alcohol_frequency ?? null,
    p_exercise: input.exercise ?? null,
    p_exercise_frequency: input.exercise_frequency ?? null,
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Creates a new pre-consultation draft for an appointment
 * Returns the existing one if already created (idempotent)
 */
export async function createPreConsultation(appointmentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_pre_consultation', {
    p_appointment_id: appointmentId,
  });

  if (error) throw new Error(mapApiError(error.message));
  return data as string;
}

/**
 * Gets a pre-consultation by its ID
 */
export async function getPreConsultation(id: string): Promise<PreConsultation | null> {
  const { data, error } = await supabase
    .from('pre_consultations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return await mapPreConsultationRow(data as Record<string, unknown>);
}

/**
 * Gets a pre-consultation by appointment ID (for patient editing or doctor viewing)
 */
export async function getPreConsultationByAppointment(
  appointmentId: string
): Promise<PreConsultation | null> {
  const { data, error } = await supabase.rpc('get_pre_consultation_by_appointment', {
    p_appointment_id: appointmentId,
  });

  if (error) throw new Error(mapApiError(error.message));

  const rows = data as Record<string, unknown>[] | null;
  if (!rows || rows.length === 0) return null;
  return await mapPreConsultationRow(rows[0]);
}

/**
 * Updates a draft pre-consultation (auto-save)
 * RULE-022b: Cannot update after SUBMITTED
 */
export async function updatePreConsultation(
  id: string,
  input: UpdatePreConsultationInput
): Promise<string> {
  const { data, error } = await supabase.rpc('update_pre_consultation', {
    p_id: id,
    p_chief_complaint: input.chief_complaint ?? null,
    p_symptom_duration: input.symptom_duration ?? null,
    p_symptom_duration_unit: input.symptom_duration_unit ?? null,
    p_pain_scale: input.pain_scale ?? null,
    p_symptom_tags: input.symptom_tags ?? null,
    p_medical_history: input.medical_history ?? null,
    p_surgical_history: input.surgical_history ?? null,
    p_family_history: input.family_history ?? null,
    p_current_medications: input.current_medications ?? null,
    p_otc_supplements: input.otc_supplements ?? null,
    p_drug_allergies: input.drug_allergies ?? null,
    p_food_allergies: input.food_allergies ?? null,
    p_smoking: input.smoking ?? null,
    p_smoking_frequency: input.smoking_frequency ?? null,
    p_alcohol: input.alcohol ?? null,
    p_alcohol_frequency: input.alcohol_frequency ?? null,
    p_exercise: input.exercise ?? null,
    p_exercise_frequency: input.exercise_frequency ?? null,
  });

  if (error) throw new Error(mapApiError(error.message));
  return data as string;
}

/**
 * Submits a pre-consultation (finalizes, computes flags)
 * RULE-022b: After SUBMITTED, cannot be modified
 * RULE-022d: drug_allergies >= 1 → flag
 * RULE-022e: pain_scale >= 7 → flag
 */
export async function submitPreConsultation(id: string): Promise<SubmitPreConsultationResult> {
  const { data, error } = await supabase.rpc('submit_pre_consultation', {
    p_id: id,
  });

  if (error) throw new Error(mapApiError(error.message));

  const rows = data as { id: string; flags: PreConsultationFlags }[] | null;
  if (!rows || rows.length === 0) {
    throw new Error('Không nhận được kết quả từ server');
  }

  return {
    id: String(rows[0].id),
    flags: parseFlags(rows[0].flags),
  };
}

/**
 * Gets all pre-consultations for the current patient
 */
export async function getMyPreConsultations(): Promise<PreConsultation[]> {
  const { data, error } = await supabase
    .from('pre_consultations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return Promise.all(
    ((data ?? []) as Record<string, unknown>[]).map(row => mapPreConsultationRow(row))
  );
}

/**
 * Checks if a pre-consultation exists for an appointment
 */
export async function hasPreConsultation(appointmentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pre_consultations')
    .select('id')
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data !== null;
}

/**
 * Gets pre-consultation status for an appointment
 * Returns: 'none' | 'draft' | 'submitted'
 */
export async function getPreConsultationStatus(
  appointmentId: string
): Promise<'none' | 'draft' | 'submitted'> {
  const { data, error } = await supabase
    .from('pre_consultations')
    .select('status')
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return 'none';
  return (data as { status: string }).status.toLowerCase() as 'draft' | 'submitted';
}

/**
 * Gets patient + doctor pre-consultation bundle with creator names
 */
export async function getPreConsultationBundle(
  appointmentId: string,
): Promise<PreConsultationBundle> {
  const { data, error } = await supabase.rpc('get_pre_consultation_bundle', {
    p_appointment_id: appointmentId,
  });

  if (error) throw new Error(mapApiError(error.message));
  return await mapBundlePayload((data ?? {}) as Record<string, unknown>);
}

/**
 * Creates or returns existing doctor pre-consultation for an appointment
 */
export async function createOrGetDoctorPreConsultation(appointmentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_or_get_doctor_pre_consultation', {
    p_appointment_id: appointmentId,
  });

  if (error) throw new Error(mapApiError(error.message));
  return data as string;
}

/**
 * Updates doctor pre-consultation (auto-save)
 */
export async function updateDoctorPreConsultation(
  id: string,
  input: UpdateDoctorPreConsultationInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('update_doctor_pre_consultation', {
    p_id: id,
    ...buildUpdateRpcParams(input),
  });

  if (error) throw new Error(mapApiError(error.message));
  return data as string;
}

export { mapBundlePayload, mapDoctorPreConsultationRow, mapPreConsultationRow };

// ─── Error Mapping ───────────────────────────────────────────────────────────

function mapApiError(message: string): string {
  if (message.includes('UNAUTHORIZED'))
    return 'Bạn không có quyền thực hiện thao tác này.';
  if (message.includes('APPOINTMENT_NOT_FOUND'))
    return 'Không tìm thấy lịch hẹn.';
  if (message.includes('INVALID_APPOINTMENT_STATUS'))
    return 'Không thể khai báo cho lịch hẹn đã kết thúc hoặc đã hủy.';
  if (message.includes('NOT_FOUND'))
    return 'Không tìm thấy phiếu khai báo.';
  if (message.includes('ALREADY_SUBMITTED'))
    return 'Phiếu khai báo đã được gửi, không thể sửa đổi.';
  if (message.includes('VALIDATION_ERROR: chief_complaint'))
    return 'Vui lòng nhập lý do đến khám.';
  if (message.includes('VALIDATION_ERROR: symptom_duration'))
    return 'Vui lòng nhập thời gian triệu chứng.';
  return message;
}

// ─── Error Code Constants ────────────────────────────────────────────────────

export const PRE_CONSULTATION_ERRORS = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  INVALID_APPOINTMENT_STATUS: 'INVALID_APPOINTMENT_STATUS',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_SUBMITTED: 'ALREADY_SUBMITTED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;
