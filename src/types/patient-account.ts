export type EmergencyContact = {
  id: string;
  patient_user_id: string;
  full_name: string;
  relationship: string;
  phone_number: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccessibilityPreferences = {
  patient_user_id: string;
  communication_language: string | null;
  interpreter_needed: string | null;
  mobility_support: string | null;
  additional_notes: string | null;
  updated_at: string;
};

export type SexualHealthRecord = {
  patient_user_id: string;
  sexual_orientation: string | null;
  sex_at_birth: string | null;
  prep_pep_status: string | null;
  last_std_test_date: string | null;
  last_std_test_result: string | null;
  notes_for_doctor: string | null;
  updated_at: string;
};

export type PatientAccountSettings = {
  patient_user_id: string;
  appointment_reminders: boolean;
  test_result_notifications: boolean;
  password_updated_at: string | null;
  mfa_enabled: boolean;
  mfa_phone: string | null;
  updated_at: string;
};

export type CareTeamMember = {
  doctor_id: string;
  doctor_name: string;
  specialty: string | null;
  facility_name: string | null;
  last_appointment_at: string | null;
};

export type SelfVitalRecord = {
  id: string;
  patient_user_id: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  temperature_c: number | null;
  recorded_at: string;
  source: string;
};

export type VitalsSummary = {
  blood_pressure: {
    systolic: number | null;
    diastolic: number | null;
    recorded_at: string | null;
    source: string | null;
    status: string | null;
  };
  weight: {
    kg: number | null;
    recorded_at: string | null;
    source: string | null;
  };
  height: {
    cm: number | null;
    bmi: number | null;
    bmi_status: string | null;
    source: string | null;
  };
  temperature: {
    celsius: number | null;
    recorded_at: string | null;
    source: string | null;
  };
};

export function mapEmergencyContact(row: Record<string, unknown>): EmergencyContact {
  return {
    id: String(row.id),
    patient_user_id: String(row.patient_user_id),
    full_name: String(row.full_name ?? ""),
    relationship: String(row.relationship ?? ""),
    phone_number: String(row.phone_number ?? ""),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapAccessibilityPreferences(row: Record<string, unknown>): AccessibilityPreferences {
  return {
    patient_user_id: String(row.patient_user_id),
    communication_language: row.communication_language != null ? String(row.communication_language) : null,
    interpreter_needed: row.interpreter_needed != null ? String(row.interpreter_needed) : null,
    mobility_support: row.mobility_support != null ? String(row.mobility_support) : null,
    additional_notes: row.additional_notes != null ? String(row.additional_notes) : null,
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapSexualHealthRecord(row: Record<string, unknown>): SexualHealthRecord {
  return {
    patient_user_id: String(row.patient_user_id),
    sexual_orientation: row.sexual_orientation != null ? String(row.sexual_orientation) : null,
    sex_at_birth: row.sex_at_birth != null ? String(row.sex_at_birth) : null,
    prep_pep_status: row.prep_pep_status != null ? String(row.prep_pep_status) : null,
    last_std_test_date: row.last_std_test_date != null ? String(row.last_std_test_date) : null,
    last_std_test_result: row.last_std_test_result != null ? String(row.last_std_test_result) : null,
    notes_for_doctor: row.notes_for_doctor != null ? String(row.notes_for_doctor) : null,
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapPatientAccountSettings(row: Record<string, unknown>): PatientAccountSettings {
  return {
    patient_user_id: String(row.patient_user_id),
    appointment_reminders: Boolean(row.appointment_reminders ?? true),
    test_result_notifications: Boolean(row.test_result_notifications ?? true),
    password_updated_at: row.password_updated_at != null ? String(row.password_updated_at) : null,
    mfa_enabled: Boolean(row.mfa_enabled ?? false),
    mfa_phone: row.mfa_phone != null ? String(row.mfa_phone) : null,
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapSelfVitalRecord(row: Record<string, unknown>): SelfVitalRecord {
  return {
    id: String(row.id),
    patient_user_id: String(row.patient_user_id),
    bp_systolic: row.bp_systolic != null ? Number(row.bp_systolic) : null,
    bp_diastolic: row.bp_diastolic != null ? Number(row.bp_diastolic) : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    temperature_c: row.temperature_c != null ? Number(row.temperature_c) : null,
    recorded_at: String(row.recorded_at ?? ""),
    source: String(row.source ?? "self"),
  };
}

export function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmiStatus(bmi: number | null): string | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 25) return "Bình thường";
  if (bmi < 30) return "Thừa cân";
  return "Béo phì";
}

export function bloodPressureStatus(systolic: number | null, diastolic: number | null): string | null {
  if (systolic == null || diastolic == null) return null;
  if (systolic <= 120 && diastolic <= 80) return "Bình thường";
  if (systolic < 130 && diastolic < 80) return "Tăng nhẹ";
  if (systolic < 140 && diastolic < 90) return "Tăng vừa";
  return "Cao";
}
