import { supabase } from "@/lib/supabase";
import {
  bloodPressureStatus,
  bmiStatus,
  computeBmi,
  mapSelfVitalRecord,
  type SelfVitalRecord,
  type VitalsSummary,
} from "@/types/patient-account";

function mapVitalsSummary(raw: Record<string, unknown>): VitalsSummary {
  const bp = (raw.blood_pressure ?? {}) as Record<string, unknown>;
  const weight = (raw.weight ?? {}) as Record<string, unknown>;
  const height = (raw.height ?? {}) as Record<string, unknown>;
  const temp = (raw.temperature ?? {}) as Record<string, unknown>;

  const systolic = bp.systolic != null ? Number(bp.systolic) : null;
  const diastolic = bp.diastolic != null ? Number(bp.diastolic) : null;
  const weightKg = weight.kg != null ? Number(weight.kg) : null;
  const heightCm = height.cm != null ? Number(height.cm) : null;
  const bmi = height.bmi != null ? Number(height.bmi) : computeBmi(weightKg, heightCm);

  return {
    blood_pressure: {
      systolic,
      diastolic,
      recorded_at: bp.recorded_at != null ? String(bp.recorded_at) : null,
      source: bp.source != null ? String(bp.source) : null,
      status: bloodPressureStatus(systolic, diastolic),
    },
    weight: {
      kg: weightKg,
      recorded_at: weight.recorded_at != null ? String(weight.recorded_at) : null,
      source: weight.source != null ? String(weight.source) : null,
    },
    height: {
      cm: heightCm,
      bmi,
      bmi_status: bmiStatus(bmi),
      source: height.source != null ? String(height.source) : null,
    },
    temperature: {
      celsius: temp.celsius != null ? Number(temp.celsius) : null,
      recorded_at: temp.recorded_at != null ? String(temp.recorded_at) : null,
      source: temp.source != null ? String(temp.source) : null,
    },
  };
}

export async function getMyVitalsSummary(): Promise<VitalsSummary> {
  const { data, error } = await supabase.rpc("get_my_vitals_summary");
  if (error) throw new Error(error.message);
  return mapVitalsSummary((data ?? {}) as Record<string, unknown>);
}

export type SelfVitalInput = {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  temperature_c?: number | null;
};

export async function addSelfVital(input: SelfVitalInput): Promise<SelfVitalRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("patient_self_vitals")
    .insert({
      patient_user_id: user.id,
      bp_systolic: input.bp_systolic ?? null,
      bp_diastolic: input.bp_diastolic ?? null,
      weight_kg: input.weight_kg ?? null,
      height_cm: input.height_cm ?? null,
      temperature_c: input.temperature_c ?? null,
      source: "self",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapSelfVitalRecord(data as Record<string, unknown>);
}

export async function listSelfVitals(limit = 10): Promise<SelfVitalRecord[]> {
  const { data, error } = await supabase
    .from("patient_self_vitals")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSelfVitalRecord(row as Record<string, unknown>));
}

export function formatVitalDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
