import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import type { PortalType } from "./portal.ts";

export type UserProfileRow = {
  user_id: string;
  email: string;
  role: string;
  status?: string | null;
  role_id?: string | null;
};

const PORTAL_ROLES = new Set<PortalType>(["patient", "doctor", "admin", "customer"]);

export function normalizePortalRole(raw: string | null | undefined): PortalType | null {
  const role = raw?.trim().toLowerCase();
  if (role === "patient" || role === "doctor" || role === "admin" || role === "customer") {
    return role;
  }
  return null;
}

function parseProfileRow(data: unknown): UserProfileRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row.user_id !== "string" || typeof row.email !== "string") return null;
  return {
    user_id: row.user_id,
    email: row.email,
    role: String(row.role ?? ""),
    status: row.status != null ? String(row.status) : null,
    role_id: row.role_id != null ? String(row.role_id) : null,
  };
}

/**
 * Sau login: đọc user_profiles (RPC SECURITY DEFINER, fallback PostgREST).
 */
export async function getUserProfileForLogin(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<UserProfileRow | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: rpcData, error: rpcError } = await admin.rpc(
    "get_user_profile_for_login",
    { p_user_id: userId, p_email: normalizedEmail },
  );

  if (rpcError) {
    console.error("[get_user_profile_for_login]", rpcError.message);
  } else {
    const fromRpc = parseProfileRow(rpcData);
    if (fromRpc) return fromRpc;
  }

  const byUserId = await admin
    .from("user_profiles")
    .select("user_id, email, role, status, role_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!byUserId.error && byUserId.data) {
    return byUserId.data as UserProfileRow;
  }

  const byEmail = await admin
    .from("user_profiles")
    .select("user_id, email, role, status, role_id")
    .eq("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) {
    return byEmail.data as UserProfileRow;
  }

  return null;
}

/** Portal gate: role lấy trực tiếp từ user_profiles.role */
export async function getUserRole(
  admin: SupabaseClient,
  userId: string,
  email?: string,
): Promise<PortalType | null> {
  const profile = email
    ? await getUserProfileForLogin(admin, userId, email)
    : parseProfileRow(
      (await admin.rpc("get_user_profile_for_login", {
        p_user_id: userId,
        p_email: "",
      })).data,
    );

  if (!profile) return null;
  return normalizePortalRole(profile.role);
}

export async function upsertUserProfile(
  admin: SupabaseClient,
  userId: string,
  email: string,
  role: PortalType = "patient",
): Promise<void> {
  const { data: adminRole } = await admin
    .from("roles")
    .select("id")
    .eq("slug", role)
    .maybeSingle();

  const { error } = await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      email: email.toLowerCase(),
      role,
      role_id: adminRole?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[user_profiles] upsert", error.message);
    throw error;
  }
}

export async function syncRoleToAppMetadata(
  admin: SupabaseClient,
  userId: string,
  role: PortalType,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) {
    console.error("[app_metadata] role sync", error.message);
  }
}

export function isProfileActive(status: string | null | undefined): boolean {
  return !status || status === "active";
}

export { PORTAL_ROLES };
