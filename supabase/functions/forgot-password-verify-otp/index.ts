import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getRedis,
  MAX_OTP_ATTEMPTS,
  OTP_TTL_SECONDS,
  resetOtpAttemptKey,
  resetOtpLockKey,
  TEMP_TOKEN_TTL_SECONDS,
} from "../_shared/redis.ts";
import { signResetToken } from "../_shared/reset-token.ts";
import { getAdminClient, getUserByEmail } from "../_shared/supabase-admin.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** AC2: OTP đúng → reset_token JWT 10 phút, single-use (jti trong Redis khi complete) */
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
      return jsonResponse({ error: "INVALID_EMAIL" }, 422);
    }
    if (!OTP_RE.test(otp)) {
      return jsonResponse({ error: "INVALID_OTP", message: "OTP không hợp lệ" }, 422);
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return jsonResponse({ error: "INVALID_OTP", message: "OTP không đúng" }, 400);
    }

    const redis = getRedis();
    const lock = await redis.get(resetOtpLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(resetOtpLockKey(email));
      return jsonResponse(
        { error: "OTP_LOCKED", retryAfter: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS },
        429,
      );
    }

    const admin = getAdminClient();
    const { error } = await admin.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      const attempts = await redis.incr(resetOtpAttemptKey(email));
      await redis.expire(resetOtpAttemptKey(email), OTP_TTL_SECONDS);

      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("expired")) {
        return jsonResponse({ error: "OTP_EXPIRED", message: "OTP hết hạn" }, 410);
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await redis.set(resetOtpLockKey(email), "1", { ex: OTP_TTL_SECONDS });
        await redis.del(resetOtpAttemptKey(email));
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

    await redis.del(resetOtpAttemptKey(email));

    const { token: reset_token, jti, expiresIn } = await signResetToken(
      email,
      user.id,
    );

    return jsonResponse({
      message: "Xác minh OTP thành công",
      reset_token,
      jti,
      expiresIn: expiresIn ?? TEMP_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error(
      "[forgot-password-verify-otp]",
      err instanceof Error ? err.name : "error",
    );
    return jsonResponse({ error: "VERIFY_FAILED" }, 500);
  }
});
