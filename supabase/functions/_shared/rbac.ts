import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { jsonResponse } from "./cors.ts";
import { getAdminClient } from "./supabase-admin.ts";

export const PERMISSIONS = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_RESET_PASSWORD: "users.reset_password",
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  FACILITIES_READ: "facilities.read",
  FACILITIES_MANAGE: "facilities.manage",
  AUDIT_READ: "audit.read",
  ADMIN_ACCESS: "admin.access",
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type AuthContext = {
  admin: SupabaseClient;
  userId: string;
  email: string;
  permissions: Set<string>;
};

export async function getPermissionsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile?.role_id) return new Set();

  const { data: rows, error: permError } = await admin
    .from("role_permissions")
    .select("permissions(slug)")
    .eq("role_id", profile.role_id);

  if (permError) return new Set();

  const slugs = new Set<string>();
  for (const row of rows ?? []) {
    const perm = row.permissions as { slug?: string } | null;
    if (perm?.slug) slugs.add(perm.slug);
  }
  return slugs;
}

export async function userHasPermission(
  admin: SupabaseClient,
  userId: string,
  permission: string,
): Promise<boolean> {
  const perms = await getPermissionsForUser(admin, userId);
  return perms.has(permission);
}

/** AC3: middleware — verify JWT + permission */
export async function requirePermission(
  req: Request,
  permission: string,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Thiếu access token" }, 401);
  }

  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Token không hợp lệ" }, 401);
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? "";
  const permissions = await getPermissionsForUser(admin, userId);

  if (!permissions.has(permission)) {
    return jsonResponse(
      { error: "FORBIDDEN", message: `Thiếu quyền: ${permission}` },
      403,
    );
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.status === "locked" || profile?.status === "inactive") {
    return jsonResponse({ error: "FORBIDDEN", message: "Tài khoản bị khóa" }, 403);
  }

  return { admin, userId, email, permissions };
}

export function isAuthContext(
  value: AuthContext | Response,
): value is AuthContext {
  return value instanceof Object && "userId" in value && "admin" in value;
}

/** Verify JWT and require portal role in user_profiles (admin or doctor). */
export async function requireStaffPortalRole(
  req: Request,
  roles: ("admin" | "doctor")[],
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Thiếu access token" }, 401);
  }

  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Token không hợp lệ" }, 401);
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? "";

  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || !roles.includes(profile.role as "admin" | "doctor")) {
    return jsonResponse({ error: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." }, 403);
  }

  if (profile.status === "locked" || profile.status === "inactive") {
    return jsonResponse({ error: "FORBIDDEN", message: "Tài khoản bị khóa" }, 403);
  }

  const permissions = await getPermissionsForUser(admin, userId);
  return { admin, userId, email, permissions };
}

/** Verify JWT and require patient portal role. */
export async function requirePatientRole(
  req: Request,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Thiếu access token" }, 401);
  }

  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Token không hợp lệ" }, 401);
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? "";

  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || profile.role !== "patient") {
    return jsonResponse(
      { error: "FORBIDDEN", message: "Chỉ dành cho tài khoản bệnh nhân" },
      403,
    );
  }

  if (profile.status === "locked" || profile.status === "inactive") {
    return jsonResponse({ error: "FORBIDDEN", message: "Tài khoản bị khóa" }, 403);
  }

  return { admin, userId, email, permissions: new Set<string>() };
}
