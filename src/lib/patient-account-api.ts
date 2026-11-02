import { supabase } from "@/lib/supabase";
import { decryptRow, decryptRows, encryptRow } from "@/lib/crypto";
import {
  mapAccessibilityPreferences,
  mapEmergencyContact,
  mapPatientAccountSettings,
  type AccessibilityPreferences,
  type CareTeamMember,
  type EmergencyContact,
  type PatientAccountSettings,
} from "@/types/patient-account";

async function mapDecryptedEmergencyContact(row: Record<string, unknown>): Promise<EmergencyContact> {
  try {
    const decrypted = await decryptRow(row, "patient_emergency_contacts");
    return mapEmergencyContact(decrypted);
  } catch {
    return mapEmergencyContact(row);
  }
}

export async function fetchEmergencyContacts(): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from("patient_emergency_contacts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  try {
    const decrypted = await decryptRows(
      (data ?? []) as Record<string, unknown>[],
      "patient_emergency_contacts",
    );
    return decrypted.map((row) => mapEmergencyContact(row));
  } catch {
    return (data ?? []).map((row) => mapEmergencyContact(row as Record<string, unknown>));
  }
}

export type EmergencyContactInput = {
  full_name: string;
  relationship: string;
  phone_number: string;
  sort_order?: number;
};

export async function createEmergencyContact(input: EmergencyContactInput): Promise<EmergencyContact> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const encrypted = await encryptRow(
    {
      patient_user_id: user.id,
      full_name: input.full_name.trim(),
      relationship: input.relationship.trim(),
      phone_number: input.phone_number.trim(),
      sort_order: input.sort_order ?? 0,
    },
    "patient_emergency_contacts",
  );

  const { data, error } = await supabase
    .from("patient_emergency_contacts")
    .insert(encrypted)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapDecryptedEmergencyContact(data as Record<string, unknown>);
}

export async function updateEmergencyContact(
  id: string,
  input: EmergencyContactInput,
): Promise<EmergencyContact> {
  const encrypted = await encryptRow(
    {
      full_name: input.full_name.trim(),
      relationship: input.relationship.trim(),
      phone_number: input.phone_number.trim(),
      sort_order: input.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    },
    "patient_emergency_contacts",
  );

  const { data, error } = await supabase
    .from("patient_emergency_contacts")
    .update(encrypted)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapDecryptedEmergencyContact(data as Record<string, unknown>);
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const { error } = await supabase.from("patient_emergency_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchAccessibilityPreferences(): Promise<AccessibilityPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("patient_accessibility_preferences")
    .select("*")
    .eq("patient_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapAccessibilityPreferences(data as Record<string, unknown>);
}

export type AccessibilityInput = {
  communication_language?: string | null;
  interpreter_needed?: string | null;
  mobility_support?: string | null;
  additional_notes?: string | null;
};

export async function upsertAccessibilityPreferences(
  input: AccessibilityInput,
): Promise<AccessibilityPreferences> {
  const { data, error } = await supabase.rpc("upsert_my_accessibility_preferences", {
    p_communication_language: input.communication_language ?? null,
    p_interpreter_needed: input.interpreter_needed ?? null,
    p_mobility_support: input.mobility_support ?? null,
    p_additional_notes: input.additional_notes ?? null,
  });

  if (error) throw new Error(error.message);
  return mapAccessibilityPreferences(data as Record<string, unknown>);
}

export async function fetchCareTeam(): Promise<CareTeamMember[]> {
  const { data, error } = await supabase.rpc("get_my_care_team");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    doctor_id: String(row.doctor_id),
    doctor_name: String(row.doctor_name ?? "Bác sĩ"),
    specialty: row.specialty != null ? String(row.specialty) : null,
    facility_name: row.facility_name != null ? String(row.facility_name) : null,
    last_appointment_at: row.last_appointment_at != null ? String(row.last_appointment_at) : null,
  }));
}

export async function fetchAccountSettings(): Promise<PatientAccountSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("patient_account_settings")
    .select("*")
    .eq("patient_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      patient_user_id: user.id,
      appointment_reminders: true,
      test_result_notifications: true,
      password_updated_at: null,
      mfa_enabled: false,
      mfa_phone: null,
      updated_at: new Date().toISOString(),
    };
  }

  return mapPatientAccountSettings(data as Record<string, unknown>);
}

export type AccountSettingsInput = {
  appointment_reminders?: boolean;
  test_result_notifications?: boolean;
  mfa_enabled?: boolean;
  mfa_phone?: string | null;
};

export async function upsertAccountSettings(
  input: AccountSettingsInput,
): Promise<PatientAccountSettings> {
  const { data, error } = await supabase.rpc("upsert_my_account_settings", {
    p_appointment_reminders: input.appointment_reminders ?? null,
    p_test_result_notifications: input.test_result_notifications ?? null,
    p_mfa_enabled: input.mfa_enabled ?? null,
    p_mfa_phone: input.mfa_phone ?? null,
  });

  if (error) throw new Error(error.message);
  return mapPatientAccountSettings(data as Record<string, unknown>);
}

export async function fetchMyPatientProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("patient")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function hasSubmittedProfile(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("patient")
    .select("submitted_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data?.submitted_at);
}
