import { clientIp, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { setOtpEmailContext } from "../_shared/otp-email-context.ts";
import {
  getRedis,
  OTP_TTL_SECONDS,
  resetOtpLockKey,
} from "../_shared/redis.ts";
import { emailExists, getAdminClient } from "../_shared/supabase-admin.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_MESSAGE =
  "Nếu email đã đăng ký, mã OTP đã được gửi. Kiểm tra hộp thư và thư mục Spam.";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** AC1: luôn trả 200 — không tiết lộ email có tồn tại hay không */
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
    const lock = await redis.get(resetOtpLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(resetOtpLockKey(email));
      return jsonResponse(
        {
          error: "OTP_LOCKED",
          message: GENERIC_MESSAGE,
          retryAfter: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS,
        },
        429,
      );
    }

    const exists = await emailExists(email);
    if (exists) {
      const admin = getAdminClient();
      await setOtpEmailContext(email, {
        variant: "reset",
        requestedAt: new Date().toISOString(),
        ttlSeconds: OTP_TTL_SECONDS,
      });
      const { error } = await admin.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        console.error("[forgot-password-send-otp]", error.message);
      } else {
        await writeAuditLog(admin, {
          eventType: "PASSWORD_RESET_REQUEST",
          email,
          ipAddress: clientIp(req),
          metadata: { channel: "email" },
        });
      }
    }

    return jsonResponse({
      message: GENERIC_MESSAGE,
      expiresIn: OTP_TTL_SECONDS,
    });
  } catch (err) {
    console.error(
      "[forgot-password-send-otp]",
      err instanceof Error ? err.name : "error",
    );
    return jsonResponse({
      message: GENERIC_MESSAGE,
      expiresIn: OTP_TTL_SECONDS,
    });
  }
});
