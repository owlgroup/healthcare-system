import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  ACCESS_TTL_BY_ROLE,
  REFRESH_TTL_SECONDS,
} from "../_shared/portal.ts";
import {
  fetchPatientDob,
  dobValuesMatch,
  isValidIsoDate,
} from "../_shared/patient-dob.ts";
import {
  deletePatientDobLoginSession,
  getPatientDobLoginSession,
  incrementPatientDobLoginAttempts,
} from "../_shared/patient-dob-login-session.ts";
import {
  dobAttemptKey,
  dobLockKey,
  dobVerifiedKey,
  DOB_LOCK_TTL_SECONDS,
  DOB_VERIFIED_TTL_SECONDS,
  getRedis,
  MAX_DOB_ATTEMPTS,
  MAX_PATIENT_DOB_LOGIN_ATTEMPTS,
} from "../_shared/redis.ts";
import { revokeSession } from "../_shared/session-revoke.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const body = await req.json() as { dobToken?: string; date_of_birth?: string };
    const dobToken = typeof body.dobToken === "string" ? body.dobToken.trim() : "";
    const submittedDob = typeof body.date_of_birth === "string"
      ? body.date_of_birth.trim()
      : "";

    if (!dobToken) {
      return jsonResponse({ error: "INVALID_DOB_TOKEN" }, 422);
    }

    if (!isValidIsoDate(submittedDob)) {
      return jsonResponse({
        error: "INVALID_DOB",
        message: "Vui lòng nhập ngày sinh hợp lệ",
      }, 422);
    }

    const redis = getRedis();
    const admin = getAdminClient();
    const sessionRow = await getPatientDobLoginSession(admin, dobToken);

    if (!sessionRow) {
      return jsonResponse({
        error: "DOB_TOKEN_EXPIRED",
        message: "Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.",
      }, 410);
    }

    const pending = {
      userId: sessionRow.user_id,
      email: sessionRow.email,
      access_token: sessionRow.access_token,
      refresh_token: sessionRow.refresh_token,
      expires_in: sessionRow.expires_in,
      expires_at: sessionRow.expires_at ?? undefined,
      token_type: sessionRow.token_type,
    };

    const globalLock = await redis.get(dobLockKey(pending.userId));
    if (globalLock) {
      const retryAfter = await redis.ttl(dobLockKey(pending.userId));
      await revokeSession(pending.access_token, pending.refresh_token);
      await deletePatientDobLoginSession(admin, dobToken);
      return jsonResponse({
        error: "DOB_LOCKED",
        message: "Tạm khóa do nhập sai quá nhiều lần",
        retryAfter: retryAfter > 0 ? retryAfter : DOB_LOCK_TTL_SECONDS,
      }, 429);
    }

    const patient = await fetchPatientDob(admin, pending.userId);
    if (!patient?.date_of_birth) {
      await revokeSession(pending.access_token, pending.refresh_token);
      await deletePatientDobLoginSession(admin, dobToken);
      return jsonResponse({
        error: "ONBOARDING_REQUIRED",
        message: "Vui lòng hoàn tất hồ sơ trước khi xác thực",
      }, 422);
    }

    if (!dobValuesMatch(patient.date_of_birth, submittedDob)) {
      const loginAttempts = await incrementPatientDobLoginAttempts(
        admin,
        dobToken,
        sessionRow.attempts,
      );

      const globalAttempts = await redis.incr(dobAttemptKey(pending.userId));
      if (globalAttempts === 1) {
        await redis.expire(dobAttemptKey(pending.userId), DOB_LOCK_TTL_SECONDS);
      }

      const attemptsLeft = Math.max(0, MAX_PATIENT_DOB_LOGIN_ATTEMPTS - loginAttempts);

      await writeAuditLog(admin, {
        eventType: "DOB_VERIFY_FAILED",
        userId: pending.userId,
        email: pending.email,
        ipAddress: ip,
        userAgent,
        metadata: {
          reason: "DOB_MISMATCH",
          attemptsLeft,
          phase: "login",
        },
      });

      const locked = loginAttempts >= MAX_PATIENT_DOB_LOGIN_ATTEMPTS ||
        globalAttempts >= MAX_DOB_ATTEMPTS;

      if (locked) {
        await redis.set(dobLockKey(pending.userId), "1", { ex: DOB_LOCK_TTL_SECONDS });
        await redis.del(dobAttemptKey(pending.userId));
        await revokeSession(pending.access_token, pending.refresh_token);
        await deletePatientDobLoginSession(admin, dobToken);

        await writeAuditLog(admin, {
          eventType: "DOB_VERIFY_LOCKED",
          userId: pending.userId,
          email: pending.email,
          ipAddress: ip,
          userAgent,
          metadata: { phase: "login" },
        });

        return jsonResponse({
          error: "DOB_LOCKED",
          message: "Nhập sai ngày sinh quá nhiều lần. Vui lòng đăng nhập lại.",
          retryAfter: DOB_LOCK_TTL_SECONDS,
        }, 429);
      }

      return jsonResponse({
        error: "DOB_MISMATCH",
        message: "Ngày sinh không khớp với hồ sơ. Vui lòng thử lại.",
        attemptsLeft,
      }, 401);
    }

    await redis.set(dobVerifiedKey(pending.userId), "1", { ex: DOB_VERIFIED_TTL_SECONDS });
    await redis.del(dobAttemptKey(pending.userId));
    await deletePatientDobLoginSession(admin, dobToken);

    await writeAuditLog(admin, {
      eventType: "DOB_VERIFY_SUCCESS",
      userId: pending.userId,
      email: pending.email,
      ipAddress: ip,
      userAgent,
      metadata: { phase: "login" },
    });

    await writeAuditLog(admin, {
      eventType: "LOGIN_SUCCESS",
      userId: pending.userId,
      email: pending.email,
      ipAddress: ip,
      userAgent,
      metadata: { portal: "unified", role: "patient", dobVerified: true },
    });

    return jsonResponse({
      message: "Đăng nhập thành công",
      portal: "patient",
      role: "patient",
      accessExpiresIn: ACCESS_TTL_BY_ROLE.patient,
      refreshExpiresIn: REFRESH_TTL_SECONDS,
      session: {
        access_token: pending.access_token,
        refresh_token: pending.refresh_token,
        expires_in: pending.expires_in,
        expires_at: pending.expires_at,
        token_type: pending.token_type,
      },
    });
  } catch (err) {
    console.error("[patient-dob-login]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "DOB_LOGIN_FAILED", message: "Xác thực thất bại" }, 500);
  }
});
