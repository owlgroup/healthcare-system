/**
 * FR-010 / FR-011: EMR — SOAP Note types and Doctor Approval
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ExamStatus = 'DRAFT' | 'LOCKED';

export type IcdConfirmStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

// ─── ICD Code on SOAP Note ───────────────────────────────────────────────────

export type SoapIcdCode = {
  id: string;
  exam_id: string;
  icd_code: string;
  icd_name: string;
  is_ai_suggested: boolean;
  ai_confidence: number | null;
  ai_reason: string | null;
  confirm_status: IcdConfirmStatus;
  confirmed_at: string | null;
  display_order: number;
  created_at: string;
};

// ─── Medical Examination (SOAP Note) ─────────────────────────────────────────

export type MedicalExamination = {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  s_text: string | null;
  o_text: string | null;
  a_text: string | null;
  p_text: string | null;
  status: ExamStatus;
    is_addendum: boolean;
    parent_exam_id: string | null;
    amendment_reason?: string | null;
  auto_saved_at: string | null;
  created_at: string;
  updated_at: string;
  ai_baseline?: {
    s_text: string | null;
    o_text: string | null;
    a_text: string | null;
    p_text: string | null;
  } | null;
  // Joined
  icd_codes: SoapIcdCode[];
};

// ─── Form Data ────────────────────────────────────────────────────────────────

export type SoapFormData = {
  s_text: string;
  o_text: string;
  a_text: string;
  p_text: string;
};

export const DEFAULT_SOAP_FORM: SoapFormData = {
  s_text: '',
  o_text: '',
  a_text: '',
  p_text: '',
};

// ─── AI ICD Suggestion ────────────────────────────────────────────────────────

export type AiIcdSuggestion = {
  icd_code: string;
  icd_name: string;
  confidence: number;
  reason: string;
};

// ─── Sign Examination Input ────────────────────────────────────────────────────

export type SignExaminationInput = {
  exam_id: string;
  pin_plain: string;
  responsibility_ack: boolean;
};

export type SignExaminationResult = {
  exam_id: string;
  sig_id: string;
  data_hash: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

export type SoapValidationErrors = Partial<{
  s_text: string;
  o_text: string;
  a_text: string;
  p_text: string;
  icd_codes: string;
  pin: string;
}>;

export const SOAP_SUBJECTIVE_REQUIRED_MESSAGE = 'Phần Subjective (S) là bắt buộc';
export const SOAP_OBJECTIVE_REQUIRED_MESSAGE = 'Phần Objective (O) là bắt buộc';
export const SOAP_ASSESSMENT_REQUIRED_MESSAGE = 'Phần Assessment (A) là bắt buộc';
export const SOAP_PLAN_REQUIRED_MESSAGE = 'Phần Plan (P) là bắt buộc';
export const SOAP_ICD_REQUIRED_MESSAGE = 'Cần ít nhất 1 chẩn đoán ICD-10 được xác nhận';

export const PIN_SIGN_LOCK_MESSAGE = 'Vui lòng thử lại sau 10 phút';

export function isDoctorPinLocked(pinLockedUntil: string | null, now = Date.now()): boolean {
  if (!pinLockedUntil) return false;
  const until = new Date(pinLockedUntil).getTime();
  return Number.isFinite(until) && until > now;
}

export function isPinSignLockMessage(message: string): boolean {
  return (
    message.includes('PIN_FAILED_LOCKED') ||
    message.includes('PIN_LOCKED') ||
    message.includes(PIN_SIGN_LOCK_MESSAGE)
  );
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === '';
}

export function validateSoapForSave(
  data: SoapFormData,
  icdCodes: SoapIcdCode[]
): SoapValidationErrors {
  const errors: SoapValidationErrors = {};
  if (isBlank(data.s_text)) {
    errors.s_text = SOAP_SUBJECTIVE_REQUIRED_MESSAGE;
  }
  if (isBlank(data.o_text)) {
    errors.o_text = SOAP_OBJECTIVE_REQUIRED_MESSAGE;
  }
  if (isBlank(data.a_text)) {
    errors.a_text = SOAP_ASSESSMENT_REQUIRED_MESSAGE;
  }
  if (isBlank(data.p_text)) {
    errors.p_text = SOAP_PLAN_REQUIRED_MESSAGE;
  }
  const confirmed = icdCodes.filter((c) => c.confirm_status === 'CONFIRMED');
  if (confirmed.length === 0) {
    errors.icd_codes = SOAP_ICD_REQUIRED_MESSAGE;
  }
  return errors;
}

export function validateSoapForSign(
  data: SoapFormData,
  icdCodes: SoapIcdCode[]
): SoapValidationErrors {
  return validateSoapForSave(data, icdCodes);
}

// ─── Status Labels ────────────────────────────────────────────────────────────

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: 'Đang soạn',
  LOCKED: 'Đã ký',
};

export const EXAM_STATUS_COLORS: Record<ExamStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700',
  LOCKED: 'bg-green-100 text-green-700',
};

export const ICD_CONFIRM_LABELS: Record<IcdConfirmStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã bỏ qua',
};
