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

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json() as { email?: string; otp?: string };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return jsonResponse({ error: "INVALID_EMAIL", message: "Email không hợp lệ" }, 422);
    }
    if (!OTP_RE.test(otp)) {
      return jsonResponse({ error: "INVALID_OTP", message: "OTP phải là 6 chữ số" }, 422);
    }

    const redis = getRedis();

    const lock = await redis.get(otpLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(otpLockKey(email));
      return jsonResponse(
        { error: "OTP_LOCKED", retryAfter: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS },
        429,
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      const attempts = await redis.incr(otpAttemptKey(email));
      await redis.expire(otpAttemptKey(email), OTP_TTL_SECONDS);

      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("expired")) {
        return jsonResponse({ error: "OTP_EXPIRED", message: "OTP hết hạn" }, 410);
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await redis.set(otpLockKey(email), "1", { ex: OTP_TTL_SECONDS });
        await redis.del(otpAttemptKey(email));
        return jsonResponse(
          { error: "OTP_LOCKED", retryAfter: OTP_TTL_SECONDS },
          429,
        );
      }

      return jsonResponse(
        { error: "INVALID_OTP", attemptsLeft: MAX_OTP_ATTEMPTS - attempts },
        400,
      );
    }

    await redis.del(otpAttemptKey(email));

    const session = data.session;
    if (!session) {
      return jsonResponse({ error: "VERIFY_FAILED", message: "Không tạo được phiên" }, 500);
    }

    return jsonResponse({
      message: "Xác minh OTP thành công",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      },
      needsPassword: true,
    });
  } catch (err) {
    console.error("[signup-verify-otp]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "VERIFY_FAILED" }, 500);
  }
});
