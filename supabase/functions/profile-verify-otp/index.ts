/**
 * Profile Verify OTP - Verify OTP and return unlock token for sensitive profile data
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { clientIp, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getRedis,
  MAX_OTP_ATTEMPTS,
  OTP_TTL_SECONDS,
} from "../_shared/redis.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const OTP_RE = /^\d{6}$/;
const PROFILE_OTP_ATTEMPT_PREFIX = "profile_otp_attempt:";
const PROFILE_OTP_LOCK_PREFIX = "profile_otp_lock:";
const PROFILE_UNLOCK_TTL_SECONDS = 15 * 60;

function profileOtpAttemptKey(email: string): string {
  return `${PROFILE_OTP_ATTEMPT_PREFIX}${email.toLowerCase()}`;
}

function profileOtpLockKey(email: string): string {
  return `${PROFILE_OTP_LOCK_PREFIX}${email.toLowerCase()}`;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function generateUnlockToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse(
      { error: "UNAUTHORIZED", message: "Thiếu token xác thực" },
      401,
    );
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
      return jsonResponse(
        { error: "UNAUTHORIZED", message: "Phiên đăng nhập hết hạn" },
        401,
      );
    }

    const user = userData.user;
    const body = await req.json() as { email?: string; otp?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!email || email !== user.email?.toLowerCase()) {
      return jsonResponse(
        { error: "INVALID_EMAIL", message: "Email không khớp với tài khoản" },
        422,
      );
    }

    if (!OTP_RE.test(otp)) {
      return jsonResponse(
        { error: "INVALID_OTP", message: "OTP không hợp lệ" },
        422,
      );
    }

    const redis = getRedis();
    const lock = await redis.get(profileOtpLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(profileOtpLockKey(email));
      return jsonResponse(
        {
          error: "OTP_LOCKED",
          message: "Tài khoản tạm khóa do nhập sai OTP nhiều lần",
          retryAfterSeconds: retryAfter > 0 ? retryAfter : OTP_TTL_SECONDS,
        },
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
      const attempts = await redis.incr(profileOtpAttemptKey(email));
      await redis.expire(profileOtpAttemptKey(email), OTP_TTL_SECONDS);

      const msg = error.message?.toLowerCase() ?? "";
      const isExpiredOnly = msg.includes("expired") && !msg.includes("invalid");
      if (isExpiredOnly) {
        return jsonResponse(
          { error: "OTP_EXPIRED", message: "OTP đã hết hạn" },
          410,
        );
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await redis.set(profileOtpLockKey(email), "1", { ex: OTP_TTL_SECONDS });
        await redis.del(profileOtpAttemptKey(email));
        return jsonResponse(
          {
            error: "OTP_LOCKED",
            message: "Tài khoản tạm khóa do nhập sai OTP nhiều lần",
            retryAfterSeconds: OTP_TTL_SECONDS,
          },
          429,
        );
      }

      return jsonResponse(
        {
          error: "INVALID_OTP",
          message: "OTP không đúng",
          attemptsLeft: MAX_OTP_ATTEMPTS - attempts,
        },
        400,
      );
    }

    await redis.del(profileOtpAttemptKey(email));

    const unlockToken = generateUnlockToken();
    const unlockKey = `profile_unlock:${user.id}`;
    await redis.set(unlockKey, unlockToken, { ex: PROFILE_UNLOCK_TTL_SECONDS });

    await writeAuditLog(admin, {
      eventType: "PROFILE_UNLOCKED",
      userId: user.id,
      email,
      ipAddress: clientIp(req),
      metadata: { expiresIn: PROFILE_UNLOCK_TTL_SECONDS },
    });

    return jsonResponse({
      message: "Xác thực OTP thành công",
      unlockToken,
      expiresIn: PROFILE_UNLOCK_TTL_SECONDS,
    });
  } catch (err) {
    console.error(
      "[profile-verify-otp]",
      err instanceof Error ? err.message : "error",
    );
    return jsonResponse(
      { error: "VERIFY_FAILED", message: "Không thể xác thực OTP" },
      500,
    );
  }
});
