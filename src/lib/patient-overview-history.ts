import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import {
  MEDICAL_CONDITION_OPTIONS,
  type DrugAllergyItem,
  type FoodAllergyItem,
  type MedicalHistoryItem,
  type MedicationItem,
} from '@/types/pre-consultation';
import type {
  HealthAllergy,
  HealthCondition,
  HealthMedication,
  HealthSurgery,
  PatientHealthChartView,
} from '@/types/patient-health-history';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreConsultOverviewSource = {
  medical_history: MedicalHistoryItem[];
  current_medications: MedicationItem[];
  drug_allergies: DrugAllergyItem[];
  food_allergies: FoodAllergyItem[];
  surgical_history: string | null;
};

export type OverviewHistorySlice = {
  diagnoses: HealthCondition[];
  medications: HealthMedication[];
  allergies: HealthAllergy[];
  surgeries: HealthSurgery[];
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function conditionDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = MEDICAL_CONDITION_OPTIONS.find(
    (o) => o.value === trimmed.toLowerCase() || nameKey(o.label) === nameKey(trimmed),
  );
  return match?.label ?? trimmed;
}

function conditionDedupeKey(raw: string): string {
  const trimmed = raw.trim();
  const match = MEDICAL_CONDITION_OPTIONS.find(
    (o) => o.value === trimmed.toLowerCase() || nameKey(o.label) === nameKey(trimmed),
  );
  return match ? `cond:${match.value}` : `name:${nameKey(conditionDisplayName(trimmed))}`;
}

function pushUnique<T>(
  seen: Set<string>,
  key: string,
  list: T[],
  item: T,
): void {
  if (!key || seen.has(key)) return;
  seen.add(key);
  list.push(item);
}

export function mergeOverviewHistory(
  chart: PatientHealthChartView | null,
  preConsults: PreConsultOverviewSource[],
): OverviewHistorySlice {
  const diagnoses: HealthCondition[] = [];
  const medications: HealthMedication[] = [];
  const allergies: HealthAllergy[] = [];
  const surgeries: HealthSurgery[] = [];

  const seenDiag = new Set<string>();
  const seenMed = new Set<string>();
  const seenAllergy = new Set<string>();
  const seenSurgery = new Set<string>();

  for (const item of chart?.diagnoses ?? []) {
    pushUnique(seenDiag, conditionDedupeKey(item.name), diagnoses, item);
  }
  for (const item of chart?.medications ?? []) {
    pushUnique(seenMed, nameKey(item.name), medications, item);
  }
  for (const item of chart?.allergies ?? []) {
    pushUnique(seenAllergy, nameKey(item.name), allergies, item);
  }
  for (const item of chart?.surgeries ?? []) {
    pushUnique(seenSurgery, nameKey(item.name), surgeries, item);
  }

  preConsults.forEach((pc, index) => {
    pc.medical_history.forEach((h, i) => {
      const name = conditionDisplayName(h.condition ?? '');
      if (!name) return;
      pushUnique(seenDiag, conditionDedupeKey(h.condition ?? name), diagnoses, {
        id: `pc-diag-${index}-${i}`,
        name,
        status: h.details?.trim() || undefined,
      });
    });

    pc.current_medications.forEach((m, i) => {
      const name = m.name?.trim() ?? '';
      if (!name) return;
      pushUnique(seenMed, nameKey(name), medications, {
        id: `pc-med-${index}-${i}`,
        name,
        dose: m.dose ?? '',
        frequency: m.frequency ?? '',
      });
    });

    pc.drug_allergies.forEach((a, i) => {
      const name = a.drug?.trim() ?? '';
      if (!name) return;
      pushUnique(seenAllergy, nameKey(name), allergies, {
        id: `pc-drug-${index}-${i}`,
        name,
        reaction: a.reaction ?? '',
      });
    });

    pc.food_allergies.forEach((a, i) => {
      const name = a.food?.trim() ?? '';
      if (!name) return;
      pushUnique(seenAllergy, nameKey(name), allergies, {
        id: `pc-food-${index}-${i}`,
        name,
        reaction: a.reaction ?? '',
      });
    });

    const surgeryName = pc.surgical_history?.trim() ?? '';
    if (surgeryName) {
      pushUnique(seenSurgery, nameKey(surgeryName), surgeries, {
        id: `pc-surg-${index}`,
        name: surgeryName,
      });
    }
  });

  return { diagnoses, medications, allergies, surgeries };
}

export async function listSubmittedPreConsultsForOverview(
  patientUserId: string,
): Promise<PreConsultOverviewSource[]> {
  if (!UUID_RE.test(patientUserId)) return [];

  const { data, error } = await supabase
    .from('pre_consultations')
    .select(
      'medical_history, current_medications, drug_allergies, food_allergies, surgical_history, submitted_at',
    )
    .eq('patient_id', patientUserId)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(
    rows.map(async (row) => {
      let surgicalHistory =
        row.surgical_history != null ? String(row.surgical_history) : null;
      if (surgicalHistory) {
        surgicalHistory = await decrypt(surgicalHistory);
      }
      return {
        medical_history: asArray<MedicalHistoryItem>(row.medical_history),
        current_medications: asArray<MedicationItem>(row.current_medications),
        drug_allergies: asArray<DrugAllergyItem>(row.drug_allergies),
        food_allergies: asArray<FoodAllergyItem>(row.food_allergies),
        surgical_history: surgicalHistory,
      };
    }),
  );
}
