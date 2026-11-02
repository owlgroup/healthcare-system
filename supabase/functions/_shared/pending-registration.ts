import { getAdminClient } from "./supabase-admin.ts";

export async function trackPendingRegistration(email: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("pending_registrations").upsert(
    { email },
    { onConflict: "email" },
  );
  if (error) {
    console.error("[pending_registrations] upsert", error.message);
  }
}

export async function clearPendingRegistration(email: string): Promise<void> {
  const admin = getAdminClient();
  await admin.from("pending_registrations").delete().eq("email", email);
}
