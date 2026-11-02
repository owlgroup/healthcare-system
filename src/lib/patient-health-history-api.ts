import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import {
  mapHealthHistoryRow,
  mapHealthChartViewRow,
  type HealthAffirmations,
  type HealthAllergy,
  type HealthCondition,
  type HealthImmunization,
  type HealthMedication,
  type HealthSurgery,
  type PatientHealthHistory,
  type PatientHealthChartView,
} from '@/types/patient-health-history';

// Decrypt sensitive fields in medical charts
async function decryptChartFields(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decrypted = { ...row };
  const sensitiveFields = ['emergency_contact_phone', 'emergency_contact_name', 'clinical_note'];
  for (const field of sensitiveFields) {
    const value = row[field];
    if (value && typeof value === 'string') {
      try {
        decrypted[field] = await decrypt(value);
      } catch {
        // Keep original value if decryption fails (e.g., not encrypted or invalid format)
        decrypted[field] = value;
      }
    }
  }
  return decrypted;
}

const CHART_SELECT =
  'id, patient_user_id, full_name, blood_type, preferred_language, emergency_contact_name, emergency_contact_phone, allergies, medications, diagnoses, surgeries, immunizations, affirmations, updated_at';

const CHART_SELECT_STAFF =
  `${CHART_SELECT}, height_cm, weight_kg, recent_labs`;

const CHART_SELECT_LEGACY =
  'id, patient_user_id, full_name, blood_type, emergency_contact_name, emergency_contact_phone, allergies, medications, diagnoses, updated_at';

function isSchemaMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('404')
    || m.includes('does not exist')
    || m.includes('could not find')
    || m.includes('schema cache')
    || m.includes('relation')
  );
}

function schemaSetupHint(): string {
  return 'Bảng patient_medical_charts chưa có trên Supabase. Chạy file supabase/sql/apply_medical_charts_standalone.sql trong SQL Editor (Dashboard), sau đó reload trang.';
}

async function selectMyChart(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('patient_medical_charts')
    .select(CHART_SELECT)
    .eq('patient_user_id', userId)
    .maybeSingle();

  if (!error) return data as Record<string, unknown> | null;

  if (error.message.includes('column') || error.code === '42703') {
    const legacy = await supabase
      .from('patient_medical_charts')
      .select(CHART_SELECT_LEGACY)
      .eq('patient_user_id', userId)
      .maybeSingle();
    if (legacy.error) throw new Error(isSchemaMissingError(legacy.error.message) ? schemaSetupHint() : legacy.error.message);
    return legacy.data as Record<string, unknown> | null;
  }

  if (isSchemaMissingError(error.message) || error.code === 'PGRST205') {
    throw new Error(schemaSetupHint());
  }
  throw new Error(error.message);
}

async function selectChartByUserId(
  userId: string,
  select: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('patient_medical_charts')
    .select(select)
    .eq('patient_user_id', userId)
    .maybeSingle();

  if (!error) return data as Record<string, unknown> | null;

  if (error.message.includes('column') || error.code === '42703') {
    if (select === CHART_SELECT_STAFF) {
      return selectChartByUserId(userId, CHART_SELECT);
    }
    if (select === CHART_SELECT) {
      const legacy = await supabase
        .from('patient_medical_charts')
        .select(CHART_SELECT_LEGACY)
        .eq('patient_user_id', userId)
        .maybeSingle();
      if (legacy.error) {
        throw new Error(isSchemaMissingError(legacy.error.message) ? schemaSetupHint() : legacy.error.message);
      }
      return legacy.data as Record<string, unknown> | null;
    }
  }

  if (isSchemaMissingError(error.message) || error.code === 'PGRST205') {
    throw new Error(schemaSetupHint());
  }
  throw new Error(error.message);
}

export async function fetchPatientHealthChartByUserId(
  patientUserId: string,
): Promise<PatientHealthChartView | null> {
  const data = await selectChartByUserId(patientUserId, CHART_SELECT_STAFF);
  if (!data) return null;
  // Decrypt sensitive fields before mapping
  const decrypted = await decryptChartFields(data);
  return mapHealthChartViewRow(decrypted);
}

export type HealthHistoryPatch = Partial<{
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
}>;

async function ensureChart(): Promise<PatientHealthHistory> {
  const { data, error } = await supabase.rpc('upsert_my_health_chart');
  if (error) {
    if (isSchemaMissingError(error.message) || error.code === 'PGRST202') {
      throw new Error(schemaSetupHint());
    }
    throw new Error(error.message);
  }
  return mapHealthHistoryRow(data as Record<string, unknown>);
}

export async function fetchMyHealthHistory(): Promise<PatientHealthHistory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');

  const data = await selectMyChart(user.id);
  if (!data) return ensureChart();
  // Decrypt sensitive fields before mapping
  const decrypted = await decryptChartFields(data);
  return mapHealthHistoryRow(decrypted);
}

export async function updateHealthHistory(patch: HealthHistoryPatch): Promise<PatientHealthHistory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');

  await ensureChart();

  const payload: Record<string, unknown> = { ...patch };
  if (patch.affirmations) payload.affirmations = patch.affirmations;

  // Encrypt sensitive fields before saving
  const { encrypt } = await import('@/lib/crypto');
  if (patch.emergency_contact_phone) {
    payload.emergency_contact_phone = await encrypt(patch.emergency_contact_phone);
  }
  if (patch.emergency_contact_name) {
    payload.emergency_contact_name = await encrypt(patch.emergency_contact_name);
  }

  const { data, error } = await supabase
    .from('patient_medical_charts')
    .update(payload)
    .eq('patient_user_id', user.id)
    .select(CHART_SELECT)
    .single();

  if (error) throw new Error(error.message);
  // Decrypt before returning
  const decrypted = await decryptChartFields(data as Record<string, unknown>);
  return mapHealthHistoryRow(decrypted);
}

export async function addAllergy(item: Omit<HealthAllergy, 'id'>): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  const entry: HealthAllergy = { ...item, id: crypto.randomUUID() };
  return updateHealthHistory({
    allergies: [...chart.allergies, entry],
    affirmations: { ...chart.affirmations, no_other_allergies: false },
  });
}

export async function removeAllergy(id: string): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({ allergies: chart.allergies.filter((a) => a.id !== id) });
}

export async function addMedication(item: Omit<HealthMedication, 'id'>): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  const entry: HealthMedication = { ...item, id: crypto.randomUUID() };
  return updateHealthHistory({
    medications: [...chart.medications, entry],
    affirmations: { ...chart.affirmations, no_current_medications: false },
  });
}

export async function removeMedication(id: string): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({ medications: chart.medications.filter((m) => m.id !== id) });
}

export async function addCondition(item: Omit<HealthCondition, 'id'>): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  const entry: HealthCondition = { ...item, id: crypto.randomUUID() };
  return updateHealthHistory({
    diagnoses: [...chart.diagnoses, entry],
    affirmations: { ...chart.affirmations, no_chronic_conditions: false },
  });
}

export async function removeCondition(id: string): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({ diagnoses: chart.diagnoses.filter((c) => c.id !== id) });
}

export async function addSurgery(item: Omit<HealthSurgery, 'id'>): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  const entry: HealthSurgery = { ...item, id: crypto.randomUUID() };
  return updateHealthHistory({
    surgeries: [...chart.surgeries, entry],
    affirmations: { ...chart.affirmations, no_surgeries: false },
  });
}

export async function removeSurgery(id: string): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({ surgeries: chart.surgeries.filter((s) => s.id !== id) });
}

export async function addImmunization(item: Omit<HealthImmunization, 'id'>): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  const entry: HealthImmunization = { ...item, id: crypto.randomUUID() };
  return updateHealthHistory({ immunizations: [...chart.immunizations, entry] });
}

export async function removeImmunization(id: string): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({ immunizations: chart.immunizations.filter((v) => v.id !== id) });
}

export async function setAffirmation(
  key: keyof HealthAffirmations,
  value: boolean,
): Promise<PatientHealthHistory> {
  const chart = await fetchMyHealthHistory();
  return updateHealthHistory({
    affirmations: { ...chart.affirmations, [key]: value },
  });
}

export async function updateProfileSummary(fields: {
  blood_type?: string | null;
  preferred_language?: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}): Promise<PatientHealthHistory> {
  return updateHealthHistory(fields);
}
