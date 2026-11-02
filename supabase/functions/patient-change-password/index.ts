import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  appendPasswordHistory,
  isPasswordInRecentHistory,
} from "../_shared/password-history.ts";
import { validatePassword } from "../_shared/password.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);
  const token = getBearerToken(req);

  if (!token) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Thiếu token xác thực" }, 401);
  }

  try {
    const body = await req.json() as {
      current_password?: string;
      new_password?: string;
    };
    const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (!currentPassword || !newPassword) {
      return jsonResponse({ error: "INVALID_INPUT", message: "Thiếu mật khẩu" }, 422);
    }

    const rules = validatePassword(newPassword);
    if (!rules.valid) {
      return jsonResponse({ error: "WEAK_PASSWORD", message: "Mật khẩu không đủ mạnh" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) throw new Error("Supabase credentials not configured");

    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.email) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Phiên không hợp lệ" }, 401);
    }

    const email = userData.user.email;
    const userId = userData.user.id;

    const verifyClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      return jsonResponse(
        { error: "INVALID_PASSWORD", message: "Mật khẩu hiện tại không đúng" },
        401,
      );
    }

    const admin = getAdminClient();
    const reused = await isPasswordInRecentHistory(admin, userId, newPassword);
    if (reused) {
      return jsonResponse(
        { error: "PASSWORD_REUSED", message: "Mật khẩu mới không được trùng 3 mật khẩu gần nhất" },
        400,
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      return jsonResponse({ error: "UPDATE_FAILED", message: "Không thể cập nhật mật khẩu" }, 500);
    }

    await appendPasswordHistory(admin, userId, newPassword);

    await admin.from("patient_account_settings").upsert({
      patient_user_id: userId,
      password_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "patient_user_id" });

    await writeAuditLog(admin, {
      eventType: "PASSWORD_CHANGED",
      userId,
      email,
      ipAddress: ip,
      userAgent,
      metadata: { portal: "patient" },
    });

    return jsonResponse({ message: "Đã cập nhật mật khẩu" });
  } catch (err) {
    console.error("[patient-change-password]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "CHANGE_FAILED", message: "Không thể đổi mật khẩu" }, 500);
  }
});
