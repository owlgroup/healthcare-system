import bcrypt from "npm:bcryptjs@2.4.3";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

const PASSWORD_HISTORY_ROUNDS = 12;
const HISTORY_CHECK_LIMIT = 3;

export async function hashPasswordForHistory(password: string): Promise<string> {
  return await bcrypt.hash(password, PASSWORD_HISTORY_ROUNDS);
}

export async function isPasswordInRecentHistory(
  admin: SupabaseClient,
  userId: string,
  password: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("password_history")
    .select("password_hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_CHECK_LIMIT);

  if (error) {
    console.error("[password_history] select", error.message);
    return false;
  }

  for (const row of data ?? []) {
    const hash = row.password_hash as string;
    if (await bcrypt.compare(password, hash)) {
      return true;
    }
  }
  return false;
}

export async function appendPasswordHistory(
  admin: SupabaseClient,
  userId: string,
  password: string,
): Promise<void> {
  const password_hash = await hashPasswordForHistory(password);
  const { error } = await admin.from("password_history").insert({
    user_id: userId,
    password_hash,
  });
  if (error) {
    console.error("[password_history] insert", error.message);
    return;
  }
}
