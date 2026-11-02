/**
 * FR-022: Pre-Consultation Health Declaration Types
 * Allows patients to fill health declaration before appointment
 */

export type PreConsultationStatus = 'DRAFT' | 'SUBMITTED';

// ─── Medical History ─────────────────────────────────────────────────────────

export type MedicalHistoryItem = {
  condition: string;    // e.g., 'diabetes', 'hypertension', 'heart_disease'
  details?: string;     // e.g., 'Type 2, 5 years'
};

export type FamilyHistoryItem = {
  condition: string;
  relation?: string;    // e.g., 'father', 'mother', 'sibling'
};

// ─── Medications ─────────────────────────────────────────────────────────────

export type MedicationItem = {
  name: string;         // e.g., 'Amlodipine'
  dose: string;         // e.g., '5mg'
  frequency: string;    // e.g., '1v/ngày'
};

// ─── Allergies ───────────────────────────────────────────────────────────────

export type DrugAllergyItem = {
  drug: string;         // e.g., 'Penicillin'
  reaction: string;     // e.g., 'Sốc phản vệ'
};

export type FoodAllergyItem = {
  food: string;
  reaction: string;
};

// ─── Flags (Computed on Submit) ──────────────────────────────────────────────

export type PreConsultationFlags = {
  drug_allergy: boolean;  // RULE-022d: drug_allergies >= 1
  severe_pain: boolean;   // RULE-022e: pain_scale >= 7
};

// ─── Symptom Duration Unit ───────────────────────────────────────────────────

export type SymptomDurationUnit = 'days' | 'weeks' | 'months';

// ─── Lifestyle Options ───────────────────────────────────────────────────────

export type SmokingStatus = 'never' | 'former' | 'current';
export type AlcoholStatus = 'never' | 'occasionally' | 'regularly';
export type ExerciseStatus = 'never' | 'occasionally' | 'regularly';

// ─── Full Pre-Consultation Record ────────────────────────────────────────────

export type PreConsultation = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: PreConsultationStatus;

  // Nhóm 1: Triệu chứng hiện tại
  chief_complaint: string | null;
  symptom_duration: number | null;
  symptom_duration_unit: SymptomDurationUnit | null;
  symptom_onset_at: string | null;
  pain_scale: number | null;
  symptom_tags: string[];

  // Nhóm 2: Bệnh sử
  medical_history: MedicalHistoryItem[];
  surgical_history: string | null;
  family_history: FamilyHistoryItem[];

  // Nhóm 3: Thuốc đang dùng
  current_medications: MedicationItem[];
  otc_supplements: string | null;

  // Nhóm 4: Dị ứng
  drug_allergies: DrugAllergyItem[];
  food_allergies: FoodAllergyItem[];

  // Nhóm 5: Lối sống
  smoking: SmokingStatus | null;
  smoking_frequency: string | null;
  alcohol: AlcoholStatus | null;
  alcohol_frequency: string | null;
  exercise: ExerciseStatus | null;
  exercise_frequency: string | null;

  // Computed
  flags: PreConsultationFlags;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Doctor Pre-Consultation (editable by doctor/admin) ─────────────────────

export type DoctorPreConsultation = Omit<PreConsultation, 'status' | 'submitted_at' | 'submitted_by_user_id'> & {
  created_by_user_id: string;
  updated_by_user_id: string;
};

export type PreConsultationBundle = {
  patient: PreConsultation | null;
  doctor: DoctorPreConsultation | null;
  patientCreatorName: string | null;
  doctorCreatorName: string | null;
  doctorUpdaterName: string | null;
};

export type UpdateDoctorPreConsultationInput = UpdatePreConsultationInput;

// ─── Form Data (for editing) ─────────────────────────────────────────────────

export type PreConsultationFormData = {
  // Nhóm 1: Triệu chứng hiện tại
  chief_complaint: string;
  symptom_duration: number | null;
  symptom_duration_unit: SymptomDurationUnit;
  symptom_onset_at: string | null;
  pain_scale: number;
  symptom_tags: string[];

  // Nhóm 2: Bệnh sử
  medical_history: MedicalHistoryItem[];
  surgical_history: string;
  family_history: FamilyHistoryItem[];

  // Nhóm 3: Thuốc đang dùng
  current_medications: MedicationItem[];
  otc_supplements: string;

  // Nhóm 4: Dị ứng
  drug_allergies: DrugAllergyItem[];
  food_allergies: FoodAllergyItem[];

  // Nhóm 5: Lối sống
  smoking: SmokingStatus;
  smoking_frequency: string;
  alcohol: AlcoholStatus;
  alcohol_frequency: string;
  exercise: ExerciseStatus;
  exercise_frequency: string;
};

// ─── API Input Types ─────────────────────────────────────────────────────────

export type CreatePreConsultationInput = {
  appointment_id: string;
};

export type UpdatePreConsultationInput = Partial<{
  chief_complaint: string;
  symptom_duration: number;
  symptom_duration_unit: SymptomDurationUnit;
  symptom_onset_at: string;
  pain_scale: number;
  symptom_tags: string[];
  medical_history: MedicalHistoryItem[];
  surgical_history: string;
  family_history: FamilyHistoryItem[];
  current_medications: MedicationItem[];
  otc_supplements: string;
  drug_allergies: DrugAllergyItem[];
  food_allergies: FoodAllergyItem[];
  smoking: SmokingStatus;
  smoking_frequency: string;
  alcohol: AlcoholStatus;
  alcohol_frequency: string;
  exercise: ExerciseStatus;
  exercise_frequency: string;
}>;

export type SubmitPreConsultationResult = {
  id: string;
  flags: PreConsultationFlags;
};

// ─── Form Steps ──────────────────────────────────────────────────────────────

export type PreConsultationStep =
  | 'symptoms'
  | 'medical_history'
  | 'medications'
  | 'allergies'
  | 'lifestyle';

export const PRE_CONSULTATION_STEPS: PreConsultationStep[] = [
  'symptoms',
  'medical_history',
  'medications',
  'allergies',
  'lifestyle',
];

export const STEP_LABELS: Record<PreConsultationStep, string> = {
  symptoms: 'Triệu chứng hiện tại',
  medical_history: 'Bệnh sử',
  medications: 'Thuốc đang dùng',
  allergies: 'Dị ứng',
  lifestyle: 'Lối sống',
};

export const STEP_NUMBERS: Record<PreConsultationStep, number> = {
  symptoms: 1,
  medical_history: 2,
  medications: 3,
  allergies: 4,
  lifestyle: 5,
};

// ─── Symptom Tags Options ────────────────────────────────────────────────────

export const SYMPTOM_TAG_OPTIONS = [
  { value: 'fever', label: 'Sốt' },
  { value: 'cough', label: 'Ho' },
  { value: 'shortness_of_breath', label: 'Khó thở' },
  { value: 'fatigue', label: 'Mệt' },
  { value: 'nausea', label: 'Buồn nôn' },
  { value: 'palpitations', label: 'Hồi hộp' },
  { value: 'headache', label: 'Đau đầu' },
  { value: 'dizziness', label: 'Chóng mặt' },
  { value: 'chest_pain', label: 'Đau ngực' },
  { value: 'abdominal_pain', label: 'Đau bụng' },
] as const;

// ─── Medical History Condition Options ───────────────────────────────────────

export const MEDICAL_CONDITION_OPTIONS = [
  { value: 'diabetes', label: 'Tiểu đường' },
  { value: 'hypertension', label: 'Cao huyết áp' },
  { value: 'heart_disease', label: 'Tim mạch' },
  { value: 'asthma', label: 'Hen suyễn' },
  { value: 'stroke', label: 'Đột quỵ' },
  { value: 'cancer', label: 'Ung thư' },
  { value: 'kidney_disease', label: 'Bệnh thận' },
  { value: 'liver_disease', label: 'Bệnh gan' },
  { value: 'thyroid', label: 'Tuyến giáp' },
] as const;

// ─── Duration Unit Labels ────────────────────────────────────────────────────

export const DURATION_UNIT_LABELS: Record<SymptomDurationUnit, string> = {
  days: 'Ngày',
  weeks: 'Tuần',
  months: 'Tháng',
};

// ─── Lifestyle Labels ────────────────────────────────────────────────────────

export const SMOKING_LABELS: Record<SmokingStatus, string> = {
  never: 'Không bao giờ',
  former: 'Đã bỏ',
  current: 'Đang hút',
};

export const ALCOHOL_LABELS: Record<AlcoholStatus, string> = {
  never: 'Không bao giờ',
  occasionally: 'Thỉnh thoảng',
  regularly: 'Thường xuyên',
};

export const EXERCISE_LABELS: Record<ExerciseStatus, string> = {
  never: 'Không bao giờ',
  occasionally: 'Thỉnh thoảng',
  regularly: 'Thường xuyên',
};

// ─── Default Form Data ───────────────────────────────────────────────────────

export const DEFAULT_FORM_DATA: PreConsultationFormData = {
  chief_complaint: '',
  symptom_duration: null,
  symptom_duration_unit: 'days',
  symptom_onset_at: null,
  pain_scale: 0,
  symptom_tags: [],
  medical_history: [],
  surgical_history: '',
  family_history: [],
  current_medications: [],
  otc_supplements: '',
  drug_allergies: [],
  food_allergies: [],
  smoking: 'never',
  smoking_frequency: '',
  alcohol: 'never',
  alcohol_frequency: '',
  exercise: 'never',
  exercise_frequency: '',
};

// ─── Validation ──────────────────────────────────────────────────────────────

export type PreConsultationValidationErrors = Partial<{
  chief_complaint: string;
  symptom_duration: string;
  smoking_frequency: string;
  alcohol_frequency: string;
  exercise_frequency: string;
  current_medications: string;
  drug_allergies: string;
  food_allergies: string;
}>;

export function validatePreConsultationStep(
  step: PreConsultationStep,
  data: PreConsultationFormData,
): PreConsultationValidationErrors {
  const errors: PreConsultationValidationErrors = {};

  switch (step) {
    case 'symptoms':
      if (!data.chief_complaint?.trim()) {
        errors.chief_complaint = 'Vui lòng nhập lý do đến khám';
      }
      if (data.symptom_duration === null || data.symptom_duration <= 0) {
        errors.symptom_duration = 'Vui lòng nhập thời gian triệu chứng';
      }
      break;

    case 'medications':
      if (data.current_medications.some((med) => !med.name?.trim())) {
        errors.current_medications =
          'Vui lòng điền tên thuốc cho các dòng đã thêm hoặc xóa dòng trống';
      }
      break;

    case 'allergies':
      if (data.drug_allergies.some((a) => !a.drug?.trim() || !a.reaction?.trim())) {
        errors.drug_allergies =
          'Vui lòng điền đầy đủ tên thuốc và phản ứng dị ứng hoặc xóa dòng trống';
      }
      if (data.food_allergies.some((a) => !a.food?.trim() || !a.reaction?.trim())) {
        errors.food_allergies =
          'Vui lòng điền đầy đủ loại thực ăn và phản ứng dị ứng hoặc xóa dòng trống';
      }
      break;

    case 'lifestyle':
      if (
        (data.smoking === 'current' || data.smoking === 'former') &&
        !data.smoking_frequency.trim()
      ) {
        errors.smoking_frequency = 'Vui lòng nhập thông tin hút thuốc';
      }
      if (
        (data.alcohol === 'occasionally' || data.alcohol === 'regularly') &&
        !data.alcohol_frequency.trim()
      ) {
        errors.alcohol_frequency = 'Vui lòng nhập tần suất sử dụng rượu bia';
      }
      if (
        (data.exercise === 'occasionally' || data.exercise === 'regularly') &&
        !data.exercise_frequency.trim()
      ) {
        errors.exercise_frequency = 'Vui lòng nhập chi tiết vận động';
      }
      break;

    default:
      break;
  }

  return errors;
}

export function validatePreConsultation(
  data: PreConsultationFormData,
): PreConsultationValidationErrors {
  return PRE_CONSULTATION_STEPS.reduce<PreConsultationValidationErrors>(
    (all, step) => ({ ...all, ...validatePreConsultationStep(step, data) }),
    {},
  );
}

export function isFormValid(data: PreConsultationFormData): boolean {
  return Object.keys(validatePreConsultation(data)).length === 0;
}

export function isPreConsultationStepValid(
  step: PreConsultationStep,
  data: PreConsultationFormData,
): boolean {
  return Object.keys(validatePreConsultationStep(step, data)).length === 0;
}
