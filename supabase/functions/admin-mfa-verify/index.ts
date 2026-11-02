import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  ACCESS_TTL_BY_ROLE,
  REFRESH_TTL_SECONDS,
} from "../_shared/portal.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const OTP_RE = /^\d{6}$/;
const MAX_MFA_ATTEMPTS = 3;
const ADMIN_MFA_TTL_SECONDS = 300;

function getAnonClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase anon credentials not configured");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const body = await req.json() as { mfaToken?: string; otp?: string };
    const mfaToken = typeof body.mfaToken === "string" ? body.mfaToken.trim() : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!mfaToken) {
      return jsonResponse({ error: "INVALID_MFA_TOKEN" }, 422);
    }
    if (!OTP_RE.test(otp)) {
      return jsonResponse({ error: "INVALID_OTP", message: "OTP không hợp lệ" }, 422);
    }

    const admin = getAdminClient();

    // Tra cứu session từ DB
    const now = new Date().toISOString();
    const { data: sessionRow, error: dbError } = await admin
      .from("admin_mfa_sessions")
      .select("*")
      .eq("mfa_token", mfaToken)
      .gt("expires_at", now)
      .maybeSingle();

    console.log("[admin-mfa-verify] lookup token:", mfaToken, "now:", now, "found:", !!sessionRow, "dbError:", dbError?.message ?? null);

    if (dbError || !sessionRow) {
      return jsonResponse({
        error: "MFA_TOKEN_EXPIRED",
        message: "Phiên MFA đã hết hạn. Vui lòng đăng nhập lại.",
      }, 410);
    }

    const anonClient = getAnonClient();

    // Xác minh OTP qua anon client — phải khớp với client đã gửi OTP
    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      email: sessionRow.email,
      token: otp,
      type: "email",
    });

    if (verifyError || !verifyData?.session) {
      const newAttempts = (sessionRow.attempts as number) + 1;

      await writeAuditLog(admin, {
        eventType: "ADMIN_MFA_FAILED",
        userId: sessionRow.user_id,
        email: sessionRow.email,
        ipAddress: ip,
        userAgent,
        metadata: { attempts: newAttempts },
      });

      if (newAttempts >= MAX_MFA_ATTEMPTS) {
        await admin.from("admin_mfa_sessions").delete().eq("mfa_token", mfaToken);
        return jsonResponse({
          error: "MFA_LOCKED",
          message: "Nhập sai OTP quá nhiều lần. Vui lòng đăng nhập lại.",
        }, 429);
      }

      await admin
        .from("admin_mfa_sessions")
        .update({ attempts: newAttempts })
        .eq("mfa_token", mfaToken);

      return jsonResponse({
        error: "INVALID_OTP",
        message: "Mã OTP không đúng",
        attemptsLeft: MAX_MFA_ATTEMPTS - newAttempts,
      }, 400);
    }

    // OTP đúng — dùng session từ verifyOtp trực tiếp, không cần re-signin
    await admin.from("admin_mfa_sessions").delete().eq("mfa_token", mfaToken);

    await writeAuditLog(admin, {
      eventType: "ADMIN_MFA_SUCCESS",
      userId: sessionRow.user_id,
      email: sessionRow.email,
      ipAddress: ip,
      userAgent,
      metadata: { portal: sessionRow.portal },
    });

    const newSession = verifyData.session;
    return jsonResponse({
      message: "Đăng nhập thành công",
      portal: "admin",
      role: "admin",
      accessExpiresIn: ACCESS_TTL_BY_ROLE["admin"],
      refreshExpiresIn: REFRESH_TTL_SECONDS,
      session: {
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
        expires_in: newSession.expires_in,
        expires_at: newSession.expires_at,
        token_type: newSession.token_type,
      },
    });
  } catch (err) {
    console.error("[admin-mfa-verify]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "MFA_VERIFY_FAILED" }, 500);
  }
});
