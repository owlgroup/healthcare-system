import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { setOtpEmailContext } from "../_shared/otp-email-context.ts";
import {
  getRedis,
  otpLockKey,
  OTP_TTL_SECONDS,
} from "../_shared/redis.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (userError || !userData.user?.email) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json() as { email?: string };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : userData.user.email;

    if (!EMAIL_RE.test(email) || email !== userData.user.email.toLowerCase()) {
      return jsonResponse({ error: "INVALID_EMAIL", message: "Email không khớp tài khoản" }, 422);
    }

    const redis = getRedis();
    const lock = await redis.get(otpLockKey(`mfa:${email}`));
    if (lock) {
      const retryAfter = await redis.ttl(otpLockKey(`mfa:${email}`));
      return jsonResponse({ error: "OTP_LOCKED", retryAfter: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS }, 429);
    }

    await setOtpEmailContext(email, {
      variant: "patient_mfa",
      requestedAt: new Date().toISOString(),
      ttlSeconds: OTP_TTL_SECONDS,
    });

    return jsonResponse({
      message: "OK — client gọi signInWithOtp để gửi OTP bật 2FA",
      expiresIn: OTP_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[patient-mfa-enroll]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "ENROLL_FAILED" }, 500);
  }
});
