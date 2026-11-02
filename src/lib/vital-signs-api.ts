import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecordVitalSignsInput,
  RecordVitalSignsResult,
  VitalSignsRow,
} from "@/types/vital-signs";

export async function recordVitalSigns(
  supabase: SupabaseClient,
  input: RecordVitalSignsInput,
): Promise<{ result: RecordVitalSignsResult | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("record_vital_signs", {
    p_appointment_id:   input.appointment_id,
    p_bp_systolic:      input.bp_systolic      ?? null,
    p_bp_diastolic:     input.bp_diastolic     ?? null,
    p_heart_rate:       input.heart_rate       ?? null,
    p_temperature_c:    input.temperature_c    ?? null,
    p_respiratory_rate: input.respiratory_rate ?? null,
    p_spo2:             input.spo2             ?? null,
    p_weight_kg:        input.weight_kg        ?? null,
    p_height_cm:        input.height_cm        ?? null,
    p_clinical_note:    input.clinical_note    ?? null,
  });

  if (error) return { result: null, error: new Error(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { result: null, error: new Error("No result returned") };

  return {
    result: {
      id:             row.id as string,
      is_critical:    row.is_critical as boolean,
      critical_flags: (row.critical_flags as string[]) ?? [],
    },
    error: null,
  };
}

export async function getLatestVitalSigns(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<{ vitals: VitalSignsRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { vitals: null, error: new Error(error.message) };
  return { vitals: data as VitalSignsRow | null, error: null };
}

export async function listVitalSignsByAppointment(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<{ vitals: VitalSignsRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("recorded_at", { ascending: false });

  if (error) return { vitals: [], error: new Error(error.message) };
  return { vitals: (data ?? []) as VitalSignsRow[], error: null };
}

export async function updateVitalSigns(
  supabase: SupabaseClient,
  id: string,
  input: Omit<RecordVitalSignsInput, "appointment_id">,
): Promise<{ result: RecordVitalSignsResult | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("update_vital_signs", {
    p_id:               id,
    p_bp_systolic:      input.bp_systolic      ?? null,
    p_bp_diastolic:     input.bp_diastolic     ?? null,
    p_heart_rate:       input.heart_rate       ?? null,
    p_temperature_c:    input.temperature_c    ?? null,
    p_respiratory_rate: input.respiratory_rate ?? null,
    p_spo2:             input.spo2             ?? null,
    p_weight_kg:        input.weight_kg        ?? null,
    p_height_cm:        input.height_cm        ?? null,
    p_clinical_note:    input.clinical_note    ?? null,
  });

  if (error) return { result: null, error: new Error(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { result: null, error: new Error("No result") };
  return {
    result: { id: row.id as string, is_critical: row.is_critical as boolean, critical_flags: (row.critical_flags as string[]) ?? [] },
    error: null,
  };
}

/** Fetch all vital sign records for a patient (across all appointments), newest first. */
export async function listAllVitalSignsForPatient(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ vitals: VitalSignsRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*, appointments!inner(patient_id)")
    .eq("appointments.patient_id", patientId)
    .order("recorded_at", { ascending: false });

  if (error) return { vitals: [], error: new Error(error.message) };
  return { vitals: (data ?? []) as VitalSignsRow[], error: null };
}

/** Fetch the most recent vital sign record for a patient (across all appointments). */
export async function getLatestVitalSignsForPatient(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ vitals: VitalSignsRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*, appointments!inner(patient_id)")
    .eq("appointments.patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { vitals: null, error: new Error(error.message) };
  return { vitals: data as VitalSignsRow | null, error: null };
}
