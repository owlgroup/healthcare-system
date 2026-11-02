import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { setOtpEmailContext } from "../_shared/otp-email-context.ts";
import { trackPendingRegistration } from "../_shared/pending-registration.ts";
import {
  getRedis,
  otpLockKey,
  OTP_TTL_SECONDS,
} from "../_shared/redis.ts";
import { emailExists } from "../_shared/supabase-admin.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Chỉ validate + track pending. Gửi OTP thật qua
 * supabase.auth.signInWithOtp({ email }) trên client (supabase-js).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json() as { email?: string };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

    if (!email || !EMAIL_RE.test(email)) {
      return jsonResponse(
        { error: "INVALID_EMAIL", message: "Email không hợp lệ" },
        422,
      );
    }

    const redis = getRedis();
    const lock = await redis.get(otpLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(otpLockKey(email));
      return jsonResponse(
        {
          error: "OTP_LOCKED",
          message: "Gửi OTP tạm khóa do nhập sai quá nhiều lần",
          retryAfter: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS,
        },
        429,
      );
    }

    if (await emailExists(email)) {
      return jsonResponse(
        {
          error: "EMAIL_EXISTS",
          message: "Tài khoản đã tồn tại",
          suggestions: ["login", "forgot_password"],
        },
        409,
      );
    }

    await trackPendingRegistration(email);

    await setOtpEmailContext(email, {
      variant: "signup",
      requestedAt: new Date().toISOString(),
      ttlSeconds: OTP_TTL_SECONDS,
    });

    return jsonResponse({
      message: "OK — client gọi signInWithOtp để gửi email OTP",
      expiresIn: OTP_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[signup-send-otp]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "SEND_FAILED", message: "Không thể gửi OTP" }, 500);
  }
});
