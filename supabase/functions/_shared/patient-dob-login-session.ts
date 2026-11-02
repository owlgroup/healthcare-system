import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { PATIENT_DOB_LOGIN_TTL_SECONDS } from "./redis.ts";

export type PatientDobLoginSessionRow = {
  dob_token: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number | null;
  token_type: string;
  attempts: number;
  expires_session_at: string;
};

export type PendingPatientSession = {
  userId: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
};

export async function createPatientDobLoginSession(
  admin: SupabaseClient,
  email: string,
  userId: string,
  session: PendingPatientSession & { dobToken: string },
): Promise<void> {
  const expiresSessionAt = new Date(
    Date.now() + PATIENT_DOB_LOGIN_TTL_SECONDS * 1000,
  ).toISOString();

  await admin.from("patient_dob_login_sessions").delete().eq("email", email);

  const { error } = await admin.from("patient_dob_login_sessions").insert({
    dob_token: session.dobToken,
    user_id: userId,
    email,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at ?? null,
    token_type: session.token_type,
    expires_session_at: expiresSessionAt,
  });

  if (error) {
    throw new Error(`patient_dob_login_sessions insert: ${error.message}`);
  }
}

export async function getPatientDobLoginSession(
  admin: SupabaseClient,
  dobToken: string,
): Promise<PatientDobLoginSessionRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("patient_dob_login_sessions")
    .select("*")
    .eq("dob_token", dobToken)
    .gt("expires_session_at", now)
    .maybeSingle();

  if (error) {
    console.error("[patient-dob-login-session] lookup", error.message);
    return null;
  }

  return data as PatientDobLoginSessionRow | null;
}

export async function deletePatientDobLoginSession(
  admin: SupabaseClient,
  dobToken: string,
): Promise<void> {
  await admin.from("patient_dob_login_sessions").delete().eq("dob_token", dobToken);
}

export async function incrementPatientDobLoginAttempts(
  admin: SupabaseClient,
  dobToken: string,
  currentAttempts: number,
): Promise<number> {
  const next = currentAttempts + 1;
  await admin
    .from("patient_dob_login_sessions")
    .update({ attempts: next })
    .eq("dob_token", dobToken);
  return next;
}
