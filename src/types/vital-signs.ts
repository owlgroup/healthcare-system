export type VitalSignsRow = {
  id: string;
  appointment_id: string;
  recorded_by: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  temperature_c: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  is_critical: boolean;
  critical_flags: string[];
  clinical_note: string | null;
  recorded_at: string;
};

export type RecordVitalSignsInput = {
  appointment_id: string;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  temperature_c?: number | null;
  respiratory_rate?: number | null;
  spo2?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  clinical_note?: string | null;
};

export type RecordVitalSignsResult = {
  id: string;
  is_critical: boolean;
  critical_flags: string[];
};

// Validation ranges (RULE-014c: out-of-range warns but does not block)
export const VITAL_RANGES = {
  bp_systolic:      { min: 60,  max: 250, unit: "mmHg", label: "Tâm thu" },
  bp_diastolic:     { min: 40,  max: 150, unit: "mmHg", label: "Tâm trương" },
  heart_rate:       { min: 30,  max: 200, unit: "bpm",  label: "Nhịp tim" },
  temperature_c:    { min: 34,  max: 42,  unit: "°C",   label: "Nhiệt độ" },
  respiratory_rate: { min: 8,   max: 40,  unit: "l/ph", label: "Nhịp thở" },
  spo2:             { min: 70,  max: 100, unit: "%",    label: "SpO2" },
} as const;

export type VitalFieldKey = keyof typeof VITAL_RANGES;

export function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 25)   return "Bình thường";
  if (bmi < 30)   return "Thừa cân";
  return "Béo phì";
}

export function isOutOfRange(field: VitalFieldKey, value: number): boolean {
  const range = VITAL_RANGES[field];
  return value < range.min || value > range.max;
}

export function isCritical(values: Partial<RecordVitalSignsInput>): boolean {
  return (
    (values.bp_systolic != null  && values.bp_systolic  > 200) ||
    (values.heart_rate   != null && values.heart_rate   < 40)  ||
    (values.heart_rate   != null && values.heart_rate   > 150)
  );
}
