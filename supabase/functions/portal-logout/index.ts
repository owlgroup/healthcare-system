import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { clearPatientDobSession, getRedis } from "../_shared/redis.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

/** AC7: invalidate refresh token on logout */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const body = await req.json() as {
      access_token?: string;
      refresh_token?: string;
    };
    const access_token = body.access_token?.trim() ?? "";
    const refresh_token = body.refresh_token?.trim() ?? "";

    const admin = getAdminClient();
    let userId: string | null = null;
    let email: string | null = null;

    if (access_token) {
      const { data } = await admin.auth.getUser(access_token);
      userId = data.user?.id ?? null;
      email = data.user?.email ?? null;
    }

    if (access_token && refresh_token) {
      const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (url && anonKey) {
        const res = await fetch(`${url}/auth/v1/logout?scope=local`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token }),
        });
        if (!res.ok) {
          console.error("[portal-logout] auth logout", res.status);
        }
      }
    }

    if (userId) {
      try {
        await clearPatientDobSession(getRedis(), userId);
      } catch {
        /* best-effort */
      }
    }

    await writeAuditLog(admin, {
      eventType: "LOGOUT",
      userId,
      email,
      ipAddress: ip,
      userAgent,
      metadata: { scope: "local" },
    });

    return jsonResponse({ message: "Đã đăng xuất" });
  } catch (err) {
    console.error("[portal-logout]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "LOGOUT_FAILED" }, 500);
  }
});
