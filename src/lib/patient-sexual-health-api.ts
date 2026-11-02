import { supabase } from "@/lib/supabase";
import { decryptRow, encryptRow, sanitizeSensitiveDisplay } from "@/lib/crypto";
import { mapSexualHealthRecord, type SexualHealthRecord } from "@/types/patient-account";

export async function fetchSexualHealth(): Promise<SexualHealthRecord | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("patient_sexual_health")
    .select("*")
    .eq("patient_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  try {
    const decrypted = await decryptRow(data as Record<string, unknown>, "patient_sexual_health");
    return mapSexualHealthRecord(decrypted);
  } catch {
    return mapSexualHealthRecord(data as Record<string, unknown>);
  }
}

export type SexualHealthInput = {
  sexual_orientation?: string | null;
  sex_at_birth?: string | null;
  prep_pep_status?: string | null;
  last_std_test_date?: string | null;
  last_std_test_result?: string | null;
  notes_for_doctor?: string | null;
};

export async function upsertSexualHealth(input: SexualHealthInput): Promise<SexualHealthRecord> {
  const encrypted = await encryptRow(
    {
      sexual_orientation: input.sexual_orientation ?? null,
      sex_at_birth: input.sex_at_birth ?? null,
      prep_pep_status: input.prep_pep_status ?? null,
      last_std_test_result: input.last_std_test_result ?? null,
      notes_for_doctor: input.notes_for_doctor ?? null,
    },
    "patient_sexual_health",
  );

  const { data, error } = await supabase.rpc("upsert_my_sexual_health", {
    p_sexual_orientation: encrypted.sexual_orientation ?? null,
    p_sex_at_birth: encrypted.sex_at_birth ?? null,
    p_prep_pep_status: encrypted.prep_pep_status ?? null,
    p_last_std_test_date: input.last_std_test_date || null,
    p_last_std_test_result: encrypted.last_std_test_result ?? null,
    p_notes_for_doctor: encrypted.notes_for_doctor ?? null,
  });

  if (error) throw new Error(error.message);
  try {
    const decrypted = await decryptRow(data as Record<string, unknown>, "patient_sexual_health");
    return mapSexualHealthRecord(decrypted);
  } catch {
    return mapSexualHealthRecord(data as Record<string, unknown>);
  }
}

export function formatStdTestDisplay(date: string | null, result: string | null): string {
  const safeResult = sanitizeSensitiveDisplay(result);
  const resultText = safeResult === "—" ? "" : safeResult;
  if (!date && !resultText) return "—";
  const dateStr = date
    ? new Date(date).toLocaleDateString("vi-VN")
    : "";
  if (dateStr && resultText) return `${dateStr} (${resultText})`;
  return dateStr || resultText || "—";
}
