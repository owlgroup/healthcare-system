export type LabEntry = { name: string; date: string };

export type PatientMedicalChartRow = {
  id: string;
  patient_user_id: string;
  display_patient_id: string | null;
  full_name: string | null;
  pronouns: string | null;
  date_of_birth: string | null;
  status: string | null;
  last_visit_at: string | null;
  last_visit_label: string | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  diagnoses: string[];
  medications: string[];
  allergies: string[];
  clinical_note: string | null;
  heart_rate_bpm: number | null;
  temperature_f: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  recent_labs: LabEntry[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

export function parseJsonStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  return [];
}

export function parseRecentLabs(value: unknown): LabEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (item && typeof item === "object" && "name" in item && "date" in item) {
        const o = item as { name: unknown; date: unknown };
        return {
          name: typeof o.name === "string" ? o.name : "",
          date: typeof o.date === "string" ? o.date : "",
        };
      }
      return null;
    })
    .filter((x): x is LabEntry => x !== null && x.name.length > 0);
}

export function mapChartRow(row: Record<string, unknown>): PatientMedicalChartRow {
  return {
    id: String(row.id),
    patient_user_id: String(row.patient_user_id),
    display_patient_id: row.display_patient_id != null ? String(row.display_patient_id) : null,
    full_name: row.full_name != null ? String(row.full_name) : null,
    pronouns: row.pronouns != null ? String(row.pronouns) : null,
    date_of_birth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    status: row.status != null ? String(row.status) : null,
    last_visit_at: row.last_visit_at != null ? String(row.last_visit_at) : null,
    last_visit_label: row.last_visit_label != null ? String(row.last_visit_label) : null,
    blood_type: row.blood_type != null ? String(row.blood_type) : null,
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    diagnoses: parseJsonStringArray(row.diagnoses),
    medications: parseJsonStringArray(row.medications),
    allergies: parseJsonStringArray(row.allergies),
    clinical_note: row.clinical_note != null ? String(row.clinical_note) : null,
    heart_rate_bpm: row.heart_rate_bpm != null ? Number(row.heart_rate_bpm) : null,
    temperature_f: row.temperature_f != null ? Number(row.temperature_f) : null,
    blood_pressure_systolic: row.blood_pressure_systolic != null ? Number(row.blood_pressure_systolic) : null,
    blood_pressure_diastolic: row.blood_pressure_diastolic != null ? Number(row.blood_pressure_diastolic) : null,
    recent_labs: parseRecentLabs(row.recent_labs),
    emergency_contact_name: row.emergency_contact_name != null ? String(row.emergency_contact_name) : null,
    emergency_contact_phone: row.emergency_contact_phone != null ? String(row.emergency_contact_phone) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
