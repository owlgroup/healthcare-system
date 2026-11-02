import {
  forceAuthLogout,
  fetchWithAuthRetry,
  getAccessTokenOrRefresh,
} from "@/lib/auth-refresh";

const functionsBase = () => {
  const override = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (override) return override.replace(/\/$/, "");
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("VITE_SUPABASE_URL is not configured");
  return `${url.replace(/\/$/, "")}/functions/v1`;
};

export class AdminApiError extends Error {
  status: number;
  code?: string;
  userCount?: number;

  constructor(status: number, body: { error?: string; message?: string; userCount?: number }) {
    super(body.message ?? body.error ?? "Request failed");
    this.status = status;
    this.code = body.error;
    this.userCount = body.userCount;
  }
}

async function postAdmin<T>(path: string, payload: unknown): Promise<T> {
  const token = await getAccessTokenOrRefresh();
  if (!token) {
    await forceAuthLogout();
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetchWithAuthRetry(`${functionsBase()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
    userCount?: number;
  };

  if (!res.ok) {
    throw new AdminApiError(res.status, body);
  }

  return body;
}

export type AdminUserStatus = "active" | "inactive" | "locked";

export type AdminUserRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  status: AdminUserStatus;
  specialty: string | null;
  facility_id: string | null;
  role_id: string | null;
  updated_at: string;
  facilities: { name: string } | null;
  roles: { id: string; name: string; slug: string; portal_role: string | null } | null;
};

export type AdminRoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  portal_role: string | null;
  userCount: number;
  permissions: { id: string; slug: string; name: string; category: string }[];
};

export type PermissionRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
};

export type FacilityRow = { id: string; name: string; code: string | null };

export async function listAdminUsers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return postAdmin<{ users: AdminUserRow[]; total: number; page: number; limit: number }>(
    "admin-users",
    { action: "list", ...params },
  );
}

export async function listFacilities() {
  return postAdmin<{ facilities: FacilityRow[] }>("admin-users", { action: "facilities" });
}

export async function createAdminUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  roleId: string;
  facilityId?: string | null;
  specialty?: string | null;
  status?: AdminUserStatus;
}) {
  return postAdmin<{ message: string; userId: string; tempPassword: string; signPin?: string | null }>("admin-users", {
    action: "create",
    ...input,
  });
}

/** Staff (admin/doctor) quick-create patient auth account for walk-in flow. */
export async function createWalkinPatientUser(input: {
  fullName: string;
  email?: string;
  phone?: string;
}) {
  return postAdmin<{ message: string; userId: string }>("admin-users", {
    action: "create_walkin_patient",
    ...input,
  });
}

export async function updateAdminUser(input: {
  userId: string;
  fullName?: string;
  phone?: string;
  roleId?: string;
  facilityId?: string | null;
  specialty?: string | null;
  status?: AdminUserStatus;
}) {
  return postAdmin<{ message: string }>("admin-users", { action: "update", ...input });
}

export async function deleteAdminUser(userId: string) {
  return postAdmin<{ message: string }>("admin-users", { action: "delete", userId });
}

export async function resetAdminUserPassword(userId: string) {
  return postAdmin<{ message: string; tempPassword: string }>("admin-users", {
    action: "reset_password",
    userId,
  });
}

export async function listAdminRoles() {
  return postAdmin<{ roles: AdminRoleRow[] }>("admin-roles", { action: "list" });
}

export async function fetchMyPermissions() {
  return postAdmin<{ permissions: string[]; portalRole: string | null }>("admin-roles", {
    action: "my_permissions",
  });
}

export async function listPermissions() {
  return postAdmin<{ permissions: PermissionRow[] }>("admin-roles", { action: "permissions" });
}

export async function createAdminRole(input: {
  name: string;
  slug: string;
  description?: string;
  permissionIds: string[];
}) {
  return postAdmin<{ message: string; role: { id: string; slug: string; name: string } }>(
    "admin-roles",
    { action: "create", ...input },
  );
}

export async function updateAdminRole(input: {
  roleId: string;
  name?: string;
  description?: string;
  permissionIds?: string[];
}) {
  return postAdmin<{ message: string }>("admin-roles", { action: "update", ...input });
}

export async function deleteAdminRole(roleId: string) {
  return postAdmin<{ message: string }>("admin-roles", { action: "delete", roleId });
}
