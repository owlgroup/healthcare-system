import type { SupabaseClient } from "@supabase/supabase-js";

export type DupCheckResult = {
  cccdMatchId: string | null;
  phoneMatchId: string | null;
  nameDobMatchId: string | null;
};

/**
 * Calls the check_patient_duplicate RPC.
 * Pass only the params you want to check; omit the rest.
 * excludeUserId prevents the user from matching their own record on edit.
 */
export async function checkPatientDuplicate(
  supabase: SupabaseClient,
  params: {
    cccd?: string;
    phone?: string;
    name?: string;
    dob?: string;
    excludeUserId?: string;
  },
): Promise<DupCheckResult> {
  const { data, error } = await supabase.rpc("check_patient_duplicate", {
    p_cccd: params.cccd ?? null,
    p_phone: params.phone ?? null,
    p_name: params.name ?? null,
    p_dob: params.dob ?? null,
    p_exclude_user_id: params.excludeUserId ?? null,
  });

  if (error) throw new Error(error.message);

  return {
    cccdMatchId: (data as Record<string, string | null>)?.cccd_match ?? null,
    phoneMatchId: (data as Record<string, string | null>)?.phone_match ?? null,
    nameDobMatchId: (data as Record<string, string | null>)?.name_dob_match ?? null,
  };
}

export async function logDedupAudit(
  supabase: SupabaseClient,
  entry: {
    checkerUserId: string;
    checkType: "cccd" | "phone" | "name_dob";
    normalizedValue: string;
    matchedPatientId: string | null;
    result: "no_match" | "blocked" | "warned" | "bypassed";
    context: "onboarding" | "edit" | "admin_create";
    bypassReason?: string;
  },
): Promise<void> {
  await supabase.from("dedup_audit").insert({
    checker_user_id: entry.checkerUserId,
    check_type: entry.checkType,
    normalized_value: entry.normalizedValue,
    matched_patient_id: entry.matchedPatientId,
    result: entry.result,
    context: entry.context,
    bypass_reason: entry.bypassReason ?? null,
  });
}
