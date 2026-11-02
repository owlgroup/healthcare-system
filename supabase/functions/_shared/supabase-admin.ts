import { createClient } from "npm:@supabase/supabase-js@2.49.1";

export function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const admin = getAdminClient();
  const normalized = email.trim().toLowerCase();

  const adminAuth = admin.auth.admin as {
    getUserByEmail?: (e: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message?: string; status?: number } | null;
    }>;
  };

  if (typeof adminAuth.getUserByEmail === "function") {
    const { data, error } = await adminAuth.getUserByEmail(normalized);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (error.status === 404 || msg.includes("not found")) {
        return null;
      }
      throw error;
    }
    if (!data?.user?.id) return null;
    return { id: data.user.id, email: data.user.email ?? normalized };
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const user = (data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === normalized,
  );
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? normalized };
}

export async function emailExists(email: string): Promise<boolean> {
  return (await getUserByEmail(email)) !== null;
}

/** Đăng xuất mọi phiên (refresh token) — AC4. Best-effort, không throw. */
export async function signOutAllSessions(userId: string): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.warn("[signOutAllSessions] missing credentials");
    return;
  }

  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "global" }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[signOutAllSessions]", res.status, text);
    }
  } catch (err) {
    console.warn(
      "[signOutAllSessions]",
      err instanceof Error ? err.message : "error",
    );
  }
}
