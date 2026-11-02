export type HealthAllergy = {
  id: string;
  name: string;
  severity?: string;
  reaction: string;
};

export type HealthMedication = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  pharmacy?: string;
  refills_remaining?: number;
};

export type HealthCondition = {
  id: string;
  name: string;
  diagnosed_year?: number;
  status?: string;
};

export type HealthSurgery = {
  id: string;
  name: string;
  year?: number;
  notes?: string;
};

export type HealthImmunization = {
  id: string;
  name: string;
  date: string;
};

export type HealthAffirmations = {
  no_other_allergies?: boolean;
  no_current_medications?: boolean;
  no_chronic_conditions?: boolean;
  no_surgeries?: boolean;
  immunization_up_to_date?: boolean;
};

export type PatientHealthHistory = {
  id: string;
  patient_user_id: string;
  full_name: string | null;
  blood_type: string | null;
  preferred_language: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: HealthAllergy[];
  medications: HealthMedication[];
  diagnoses: HealthCondition[];
  surgeries: HealthSurgery[];
  immunizations: HealthImmunization[];
  affirmations: HealthAffirmations;
  updated_at: string;
};

export const DEFAULT_AFFIRMATIONS: HealthAffirmations = {
  no_other_allergies: false,
  no_current_medications: false,
  no_chronic_conditions: false,
  no_surgeries: false,
  immunization_up_to_date: false,
};

export const LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export const BLOOD_TYPE_OPTIONS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
] as const;

function parseObjectArray<T>(
  value: unknown,
  mapItem: (item: Record<string, unknown>, index: number) => T | null,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return mapItem(item as Record<string, unknown>, index);
      }
      if (typeof item === 'string' && item.trim()) {
        return mapItem({ legacy: item }, index);
      }
      return null;
    })
    .filter((x): x is T => x !== null);
}

export function parseAllergies(value: unknown): HealthAllergy[] {
  return parseObjectArray(value, (item, index) => {
    if ('legacy' in item) {
      return { id: `legacy-${index}`, name: String(item.legacy), reaction: '' };
    }
    const name = String(item.name ?? '').trim();
    if (!name) return null;
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name,
      severity: item.severity != null ? String(item.severity) : undefined,
      reaction: String(item.reaction ?? ''),
    };
  });
}

export function parseMedications(value: unknown): HealthMedication[] {
  return parseObjectArray(value, (item, index) => {
    if ('legacy' in item) {
      return { id: `legacy-${index}`, name: String(item.legacy), dose: '', frequency: '' };
    }
    const name = String(item.name ?? '').trim();
    if (!name) return null;
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name,
      dose: String(item.dose ?? ''),
      frequency: String(item.frequency ?? ''),
      pharmacy: item.pharmacy != null ? String(item.pharmacy) : undefined,
      refills_remaining:
        item.refills_remaining != null ? Number(item.refills_remaining) : undefined,
    };
  });
}

export function parseConditions(value: unknown): HealthCondition[] {
  return parseObjectArray(value, (item, index) => {
    if ('legacy' in item) {
      return { id: `legacy-${index}`, name: String(item.legacy), status: 'Đang kiểm soát' };
    }
    const name = String(item.name ?? '').trim();
    if (!name) return null;
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name,
      diagnosed_year: item.diagnosed_year != null ? Number(item.diagnosed_year) : undefined,
      status: item.status != null ? String(item.status) : undefined,
    };
  });
}

export function parseSurgeries(value: unknown): HealthSurgery[] {
  return parseObjectArray(value, (item) => {
    const name = String(item.name ?? '').trim();
    if (!name) return null;
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name,
      year: item.year != null ? Number(item.year) : undefined,
      notes: item.notes != null ? String(item.notes) : undefined,
    };
  });
}

export function parseImmunizations(value: unknown): HealthImmunization[] {
  return parseObjectArray(value, (item) => {
    const name = String(item.name ?? '').trim();
    if (!name) return null;
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name,
      date: String(item.date ?? ''),
    };
  });
}

export function parseAffirmations(value: unknown): HealthAffirmations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_AFFIRMATIONS };
  }
  const o = value as Record<string, unknown>;
  return {
    no_other_allergies: Boolean(o.no_other_allergies),
    no_current_medications: Boolean(o.no_current_medications),
    no_chronic_conditions: Boolean(o.no_chronic_conditions),
    no_surgeries: Boolean(o.no_surgeries),
    immunization_up_to_date: Boolean(o.immunization_up_to_date),
  };
}

export function mapHealthHistoryRow(row: Record<string, unknown>): PatientHealthHistory {
  return {
    id: String(row.id),
    patient_user_id: String(row.patient_user_id),
    full_name: row.full_name != null ? String(row.full_name) : null,
    blood_type: row.blood_type != null ? String(row.blood_type) : null,
    preferred_language: row.preferred_language != null ? String(row.preferred_language) : 'vi',
    emergency_contact_name:
      row.emergency_contact_name != null ? String(row.emergency_contact_name) : null,
    emergency_contact_phone:
      row.emergency_contact_phone != null ? String(row.emergency_contact_phone) : null,
    allergies: parseAllergies(row.allergies),
    medications: parseMedications(row.medications),
    diagnoses: parseConditions(row.diagnoses),
    surgeries: parseSurgeries(row.surgeries),
    immunizations: parseImmunizations(row.immunizations),
    affirmations: parseAffirmations(row.affirmations),
    updated_at: String(row.updated_at),
  };
}

export type LabEntry = { name: string; date: string };

export type PatientHealthChartView = PatientHealthHistory & {
  height_cm: number | null;
  weight_kg: number | null;
  recent_labs: LabEntry[];
};

export function parseRecentLabs(value: unknown): LabEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (item && typeof item === 'object' && 'name' in item && 'date' in item) {
        const o = item as { name: unknown; date: unknown };
        const name = typeof o.name === 'string' ? o.name : '';
        const date = typeof o.date === 'string' ? o.date : '';
        return name ? { name, date } : null;
      }
      return null;
    })
    .filter((x): x is LabEntry => x !== null);
}

export function mapHealthChartViewRow(row: Record<string, unknown>): PatientHealthChartView {
  return {
    ...mapHealthHistoryRow(row),
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    recent_labs: parseRecentLabs(row.recent_labs),
  };
}

export function formatConditionLabel(c: HealthCondition): string {
  const meta = [
    c.diagnosed_year ? `Chẩn đoán: ${c.diagnosed_year}` : null,
    c.status,
  ].filter(Boolean);
  return meta.length > 0 ? `${c.name} (${meta.join(' • ')})` : c.name;
}

export function formatMedicationLabel(m: HealthMedication): string {
  const dose = [m.dose, m.frequency].filter(Boolean).join(' • ');
  return dose ? `${m.name} — ${dose}` : m.name;
}

export function formatAllergyLabel(a: HealthAllergy): string {
  const meta = [a.severity, a.reaction].filter(Boolean);
  return meta.length > 0 ? `${a.name} (${meta.join(' • ')})` : a.name;
}

export function formatSurgeryLabel(s: HealthSurgery): string {
  const meta = [s.year ? `Năm ${s.year}` : null, s.notes].filter(Boolean);
  return meta.length > 0 ? `${s.name} (${meta.join(' • ')})` : s.name;
}

export function formatImmunizationLabel(v: HealthImmunization): string {
  return v.date ? `${v.name} — ${v.date}` : v.name;
}
