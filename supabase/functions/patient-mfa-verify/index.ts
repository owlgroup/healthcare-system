import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getRedis,
  MAX_OTP_ATTEMPTS,
  otpAttemptKey,
  otpLockKey,
  OTP_TTL_SECONDS,
} from "../_shared/redis.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
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
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) throw new Error("Supabase credentials not configured");

    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json() as { email?: string; otp?: string };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : userData.user.email ?? "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!EMAIL_RE.test(email) || email !== userData.user.email?.toLowerCase()) {
      return jsonResponse({ error: "INVALID_EMAIL" }, 422);
    }
    if (!OTP_RE.test(otp)) {
      return jsonResponse({ error: "INVALID_OTP", message: "OTP phải là 6 chữ số" }, 422);
    }

    const redis = getRedis();
    const lockKey = otpLockKey(`mfa:${email}`);
    const attemptKey = otpAttemptKey(`mfa:${email}`);

    const lock = await redis.get(lockKey);
    if (lock) {
      return jsonResponse({ error: "OTP_LOCKED", retryAfter: OTP_TTL_SECONDS }, 429);
    }

    const admin = getAdminClient();
    const { error } = await admin.auth.verifyOtp({ email, token: otp, type: "email" });

    if (error) {
      const attempts = await redis.incr(attemptKey);
      await redis.expire(attemptKey, OTP_TTL_SECONDS);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await redis.set(lockKey, "1", { ex: OTP_TTL_SECONDS });
        await redis.del(attemptKey);
        return jsonResponse({ error: "OTP_LOCKED", retryAfter: OTP_TTL_SECONDS }, 429);
      }
      return jsonResponse({ error: "INVALID_OTP", attemptsLeft: MAX_OTP_ATTEMPTS - attempts }, 400);
    }

    await redis.del(attemptKey);

    await admin.from("patient_account_settings").upsert({
      patient_user_id: userData.user!.id,
      mfa_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "patient_user_id" });

    await writeAuditLog(admin, {
      eventType: "MFA_ENABLED",
      userId: userData.user.id,
      email,
      ipAddress: ip,
      userAgent,
      metadata: { portal: "patient" },
    });

    return jsonResponse({ message: "Đã bật xác thực 2 yếu tố" });
  } catch (err) {
    console.error("[patient-mfa-verify]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "VERIFY_FAILED" }, 500);
  }
});
