import type { IntakeFormData } from '@/components/patient/booking/BookingIntakeForm';
import type {
  SymptomDurationUnit,
  UpdatePreConsultationInput,
} from '@/types/pre-consultation';

const DURATION_MAP: Record<string, { value: number; unit: SymptomDurationUnit }> = {
  'Định kỳ theo hẹn': { value: 1, unit: 'days' },
  'Dưới 3 ngày': { value: 3, unit: 'days' },
  'Khoảng 1 tuần': { value: 1, unit: 'weeks' },
  'Hơn 1 tháng': { value: 1, unit: 'months' },
};

const PAIN_MAP: Record<string, number> = {
  '0/10 — Không đau': 0,
  '1-3/10 — Nhẹ': 2,
  '4-6/10 — Vừa phải': 5,
  '7-10/10 — Đau nhiều': 8,
};

const NONE_ANSWERS = new Set(['', 'không', 'khong', 'không có', 'ko', 'no', 'none']);

function isNoneAnswer(text: string): boolean {
  return NONE_ANSWERS.has(text.trim().toLowerCase());
}

export function mapBookingIntakeToInput(data: IntakeFormData): UpdatePreConsultationInput {
  const duration = DURATION_MAP[data.symptom_duration] ?? { value: 1, unit: 'days' };
  const medications = data.current_medications.trim();
  const allergies = data.allergies.trim();

  return {
    chief_complaint: data.chief_complaint.trim(),
    symptom_duration: duration.value,
    symptom_duration_unit: duration.unit,
    pain_scale: PAIN_MAP[data.pain_level] ?? 0,
    current_medications: isNoneAnswer(medications)
      ? []
      : [{ name: medications, dose: '', frequency: '' }],
    drug_allergies: isNoneAnswer(allergies) ? [] : [{ drug: allergies, reaction: '' }],
  };
}
