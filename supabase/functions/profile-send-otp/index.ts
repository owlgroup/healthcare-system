/**
 * Profile Send OTP - Send OTP to user's email for unlocking sensitive profile data
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { clientIp, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { setOtpEmailContext } from "../_shared/otp-email-context.ts";
import {
  getRedis,
  OTP_TTL_SECONDS,
} from "../_shared/redis.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const PROFILE_OTP_LOCK_PREFIX = "profile_otp_lock:";

function profileOtpLockKey(email: string): string {
  return `${PROFILE_OTP_LOCK_PREFIX}${email.toLowerCase()}`;
}

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
    const body = await req.json() as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || email !== user.email?.toLowerCase()) {
      return jsonResponse(
        { error: "INVALID_EMAIL", message: "Email không khớp với tài khoản" },
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
          message: "Vui lòng chờ trước khi gửi lại OTP",
          retryAfterSeconds: retryAfter > 0 ? retryAfter : 60,
        },
        429,
      );
    }

    const admin = getAdminClient();
    await setOtpEmailContext(email, {
      variant: "profile_unlock",
      requestedAt: new Date().toISOString(),
      ttlSeconds: OTP_TTL_SECONDS,
    });

    const { error } = await admin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      console.error("[profile-send-otp]", error.message);
      return jsonResponse(
        { error: "SEND_FAILED", message: "Không thể gửi OTP" },
        500,
      );
    }

    await redis.set(profileOtpLockKey(email), "1", { ex: 60 });

    await writeAuditLog(admin, {
      eventType: "PROFILE_UNLOCK_OTP_SENT",
      userId: user.id,
      email,
      ipAddress: clientIp(req),
      metadata: { channel: "email" },
    });

    return jsonResponse({
      message: "Mã OTP đã được gửi đến email của bạn",
      expiresIn: OTP_TTL_SECONDS,
    });
  } catch (err) {
    console.error(
      "[profile-send-otp]",
      err instanceof Error ? err.message : "error",
    );
    return jsonResponse(
      { error: "SEND_FAILED", message: "Không thể gửi OTP" },
      500,
    );
  }
});
