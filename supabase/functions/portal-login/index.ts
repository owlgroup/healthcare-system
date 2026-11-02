import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendAccountLockWarningEmail } from "../_shared/login-lock-email.ts";
import { setOtpEmailContext } from "../_shared/otp-email-context.ts";
import {
  ACCESS_TTL_BY_ROLE,
  isPortalType,
  type PortalType,
  portalLoginMessage,
  REFRESH_TTL_SECONDS,
} from "../_shared/portal.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { fetchPatientDob, dobValuesMatch, isValidIsoDate } from "../_shared/patient-dob.ts";
import {
  dobAttemptKey,
  dobLockKey,
  dobVerifiedKey,
  DOB_LOCK_TTL_SECONDS,
  DOB_VERIFIED_TTL_SECONDS,
  getRedis,
  loginAttemptKey,
  loginLockKey,
  LOGIN_LOCK_TTL_SECONDS,
  MAX_DOB_ATTEMPTS,
  MAX_LOGIN_ATTEMPTS,
} from "../_shared/redis.ts";
import {
  getUserProfileForLogin,
  isProfileActive,
  normalizePortalRole,
  syncRoleToAppMetadata,
} from "../_shared/user-profile.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_MFA_TTL_SECONDS = 300;
const ADMIN_MFA_COOLDOWN_SECONDS = 60;

function getAnonClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase anon credentials not configured");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function revokeSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return;

  try {
    await fetch(`${url}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    /* best-effort */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const body = await req.json() as {
      email?: string;
      password?: string;
      portal?: string;
      date_of_birth?: string;
    };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const submittedDob = typeof body.date_of_birth === "string"
      ? body.date_of_birth.trim()
      : "";
    const portalRaw = typeof body.portal === "string" ? body.portal.trim() : "";
    const unifiedMode = !portalRaw || portalRaw === "auto";
    const requestedPortal = unifiedMode ? null : portalRaw;

    if (!email || !EMAIL_RE.test(email)) {
      return jsonResponse({ error: "INVALID_EMAIL" }, 422);
    }
    if (!password) {
      return jsonResponse({ error: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng" }, 401);
    }
    if (!unifiedMode && !isPortalType(requestedPortal)) {
      return jsonResponse({ error: "INVALID_PORTAL" }, 422);
    }

    const admin = getAdminClient();
    const anonForAuth = getAnonClient(); // dùng riêng cho signInWithPassword — tránh nhiễm user JWT vào admin client
    const redis = getRedis();

    const lock = await redis.get(loginLockKey(email));
    if (lock) {
      const retryAfter = await redis.ttl(loginLockKey(email));
      await writeAuditLog(admin, {
        eventType: "LOGIN_FAILED",
        email,
        ipAddress: ip,
        userAgent,
        metadata: { portal: portalRaw || "unified", reason: "account_locked" },
      });
      return jsonResponse(
        {
          error: "ACCOUNT_LOCKED",
          message: "Tài khoản tạm khóa do đăng nhập sai quá nhiều lần",
          retryAfter: retryAfter > 0 ? retryAfter : LOGIN_LOCK_TTL_SECONDS,
        },
        429,
      );
    }

    const { data: signInData, error: signInError } = await anonForAuth.auth
      .signInWithPassword({ email, password });

    if (signInError || !signInData.session || !signInData.user) {
      const attempts = await redis.incr(loginAttemptKey(email));
      await redis.expire(loginAttemptKey(email), LOGIN_LOCK_TTL_SECONDS);

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await redis.set(loginLockKey(email), "1", { ex: LOGIN_LOCK_TTL_SECONDS });
        await redis.del(loginAttemptKey(email));
        await sendAccountLockWarningEmail(admin, email);
        await writeAuditLog(admin, {
          eventType: "LOGIN_LOCKED",
          email,
          ipAddress: ip,
          userAgent,
          metadata: { portal: portalRaw || "unified", attempts },
        });
        return jsonResponse(
          {
            error: "ACCOUNT_LOCKED",
            message: "Đã khóa 15 phút sau 5 lần sai mật khẩu. Email cảnh báo đã được gửi.",
            retryAfter: LOGIN_LOCK_TTL_SECONDS,
          },
          429,
        );
      }

      await writeAuditLog(admin, {
        eventType: "LOGIN_FAILED",
        email,
        ipAddress: ip,
        userAgent,
        metadata: { portal: portalRaw || "unified", attemptsLeft: MAX_LOGIN_ATTEMPTS - attempts },
      });

      return jsonResponse(
        {
          error: "INVALID_CREDENTIALS",
          message: "Email hoặc mật khẩu không đúng",
          attemptsLeft: MAX_LOGIN_ATTEMPTS - attempts,
        },
        401,
      );
    }

    const session = signInData.session;
    const userId = signInData.user.id;

    const profile = await getUserProfileForLogin(admin, userId, email);

    if (!profile) {
      await revokeSession(session.access_token, session.refresh_token);
      await writeAuditLog(admin, {
        eventType: "LOGIN_WRONG_PORTAL",
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: { portal: portalRaw || "unified", reason: "profile_not_found" },
      });
      return jsonResponse(
        {
          error: "PROFILE_NOT_FOUND",
          message: "Chưa có hồ sơ user. Liên hệ quản trị để được gán role.",
          userRole: null,
          expectedPortal: requestedPortal,
          authUserId: userId,
          hint:
            "So sánh authUserId với user_profiles.user_id trong Supabase. Nếu khác, cập nhật user_id hoặc email cho khớp auth.users.",
        },
        403,
      );
    }

    if (!isProfileActive(profile.status)) {
      await revokeSession(session.access_token, session.refresh_token);
      return jsonResponse(
        {
          error: "ACCOUNT_INACTIVE",
          message: "Tài khoản đã bị khóa hoặc ngưng hoạt động",
          userRole: profile.role,
        },
        403,
      );
    }

    const userRole = normalizePortalRole(profile.role);

    if (!userRole) {
      await revokeSession(session.access_token, session.refresh_token);
      return jsonResponse(
        {
          error: "NO_ROLE",
          message: "Tài khoản chưa được gán role. Liên hệ quản trị.",
          userRole: null,
        },
        403,
      );
    }

    if (!unifiedMode && requestedPortal && userRole !== requestedPortal) {
      await revokeSession(session.access_token, session.refresh_token);
      await writeAuditLog(admin, {
        eventType: "LOGIN_WRONG_PORTAL",
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: {
          portal: requestedPortal,
          userRole,
        },
      });
      return jsonResponse(
        {
          error: "WRONG_PORTAL",
          message: portalLoginMessage(requestedPortal as PortalType),
          userRole,
          expectedPortal: requestedPortal,
        },
        403,
      );
    }

    await redis.del(loginAttemptKey(email));
    await syncRoleToAppMetadata(admin, userId, userRole);

    await admin
      .from("user_profiles")
      .update({ role: userRole, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Admin phải xác minh OTP trước khi nhận session
    if (userRole === "admin") {
      // Kiểm tra cooldown qua DB
      const now = new Date().toISOString();
      const { data: existing } = await admin
        .from("admin_mfa_sessions")
        .select("cooldown_until")
        .eq("email", email)
        .gt("cooldown_until", now)
        .maybeSingle();

      if (existing) {
        const retryAfter = Math.ceil(
          (new Date(existing.cooldown_until as string).getTime() - Date.now()) / 1000,
        );
        await revokeSession(session.access_token, session.refresh_token);
        return jsonResponse({
          error: "MFA_COOLDOWN",
          message: "OTP vừa được gửi. Vui lòng kiểm tra email hoặc đợi trước khi gửi lại.",
          retryAfter: retryAfter > 0 ? retryAfter : ADMIN_MFA_COOLDOWN_SECONDS,
        }, 429);
      }

      const { data: nameRow } = await admin
        .from("user_profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();
      const fullName =
        typeof nameRow?.full_name === "string" && nameRow.full_name.trim()
          ? nameRow.full_name.trim()
          : (email.split("@")[0] || "Admin");

      await setOtpEmailContext(email, {
        variant: "admin_mfa",
        fullName,
        ip,
        requestedAt: new Date().toISOString(),
        ttlSeconds: ADMIN_MFA_TTL_SECONDS,
      });

      // Gửi OTP qua anon client — giống luồng signup
      const anonClient = getAnonClient();
      const { error: otpError } = await anonClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      console.log("[portal-login] signInWithOtp result:", otpError
        ? { status: otpError.status, code: (otpError as { code?: string }).code, message: otpError.message }
        : "OK (no error)"
      );

      if (otpError) {
        console.error("[portal-login] signInWithOtp error:", JSON.stringify(otpError));
        return jsonResponse({ error: "MFA_SEND_FAILED", message: "Không thể gửi mã OTP" }, 500);
      }

      const mfaToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + ADMIN_MFA_TTL_SECONDS * 1000).toISOString();
      const cooldownUntil = new Date(Date.now() + ADMIN_MFA_COOLDOWN_SECONDS * 1000).toISOString();

      // Xóa session cũ và lưu session mới vào DB
      const { error: delError } = await admin.from("admin_mfa_sessions").delete().eq("email", email);
      if (delError) console.error("[portal-login] delete mfa_sessions error:", delError.message);

      const { error: insertError } = await admin.from("admin_mfa_sessions").insert({
        mfa_token: mfaToken,
        user_id: userId,
        email,
        portal: unifiedMode ? "unified" : (requestedPortal ?? "admin"),
        expires_at: expiresAt,
        cooldown_until: cooldownUntil,
      });

      if (insertError) {
        console.error("[portal-login] insert mfa_sessions error:", insertError.message, insertError.code);
        return jsonResponse({ error: "MFA_SESSION_FAILED", message: "Không thể tạo phiên MFA" }, 500);
      }

      console.log("[portal-login] mfa session inserted, token:", mfaToken);

      // Revoke session tạm từ signInWithPassword (chưa cấp cho client)
      await revokeSession(session.access_token, session.refresh_token);

      await writeAuditLog(admin, {
        eventType: "ADMIN_MFA_SENT",
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: { portal: unifiedMode ? "unified" : requestedPortal },
      });

      return jsonResponse({
        requiresMfa: true,
        mfaToken,
        expiresIn: ADMIN_MFA_TTL_SECONDS,
        message: "Vui lòng nhập mã OTP đã gửi tới email của bạn",
      });
    }

    // Bệnh nhân phải xác nhận DOB trước khi nhận session
    if (userRole === "patient") {
      const patientRecord = await fetchPatientDob(admin, userId);

      if (!patientRecord?.date_of_birth) {
        await writeAuditLog(admin, {
          eventType: "LOGIN_SUCCESS",
          userId,
          email,
          ipAddress: ip,
          userAgent,
          metadata: {
            portal: unifiedMode ? "unified" : requestedPortal,
            role: userRole,
            dobSkipped: true,
            reason: "onboarding_required",
          },
        });

        return jsonResponse({
          message: "Đăng nhập thành công",
          portal: userRole,
          role: userRole,
          accessExpiresIn: ACCESS_TTL_BY_ROLE[userRole],
          refreshExpiresIn: REFRESH_TTL_SECONDS,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
          },
        });
      }

      if (!submittedDob) {
        await revokeSession(session.access_token, session.refresh_token);
        return jsonResponse({
          requiresDob: true,
          message: "Vui lòng nhập ngày sinh để hoàn tất đăng nhập",
        });
      }

      if (!isValidIsoDate(submittedDob)) {
        await revokeSession(session.access_token, session.refresh_token);
        return jsonResponse({
          error: "INVALID_DOB",
          message: "Vui lòng nhập ngày sinh hợp lệ",
        }, 422);
      }

      const dobLock = await redis.get(dobLockKey(userId));
      if (dobLock) {
        await revokeSession(session.access_token, session.refresh_token);
        const retryAfter = await redis.ttl(dobLockKey(userId));
        return jsonResponse({
          error: "DOB_LOCKED",
          message: "Tạm khóa do nhập sai quá nhiều lần",
          retryAfter: retryAfter > 0 ? retryAfter : DOB_LOCK_TTL_SECONDS,
        }, 429);
      }

      if (!dobValuesMatch(patientRecord.date_of_birth, submittedDob)) {
        await revokeSession(session.access_token, session.refresh_token);

        const attempts = await redis.incr(dobAttemptKey(userId));
        if (attempts === 1) {
          await redis.expire(dobAttemptKey(userId), DOB_LOCK_TTL_SECONDS);
        }

        const attemptsLeft = Math.max(0, MAX_DOB_ATTEMPTS - attempts);

        await writeAuditLog(admin, {
          eventType: "DOB_VERIFY_FAILED",
          userId,
          email,
          ipAddress: ip,
          userAgent,
          metadata: { reason: "DOB_MISMATCH", attemptsLeft, phase: "login" },
        });

        if (attempts >= MAX_DOB_ATTEMPTS) {
          await redis.set(dobLockKey(userId), "1", { ex: DOB_LOCK_TTL_SECONDS });
          await redis.del(dobAttemptKey(userId));
          await writeAuditLog(admin, {
            eventType: "DOB_VERIFY_LOCKED",
            userId,
            email,
            ipAddress: ip,
            userAgent,
            metadata: { phase: "login" },
          });
          return jsonResponse({
            error: "DOB_LOCKED",
            message: "Nhập sai ngày sinh quá nhiều lần. Vui lòng thử lại sau.",
            retryAfter: DOB_LOCK_TTL_SECONDS,
          }, 429);
        }

        return jsonResponse({
          error: "DOB_MISMATCH",
          message: "Ngày sinh không khớp với hồ sơ. Vui lòng thử lại.",
          attemptsLeft,
        }, 401);
      }

      await redis.set(dobVerifiedKey(userId), "1", { ex: DOB_VERIFIED_TTL_SECONDS });
      await redis.del(dobAttemptKey(userId));

      await writeAuditLog(admin, {
        eventType: "DOB_VERIFY_SUCCESS",
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: { phase: "login" },
      });

      await writeAuditLog(admin, {
        eventType: "LOGIN_SUCCESS",
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: {
          portal: unifiedMode ? "unified" : requestedPortal,
          role: userRole,
          dobVerified: true,
        },
      });

      return jsonResponse({
        message: "Đăng nhập thành công",
        portal: userRole,
        role: userRole,
        accessExpiresIn: ACCESS_TTL_BY_ROLE[userRole],
        refreshExpiresIn: REFRESH_TTL_SECONDS,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
        },
      });
    }

    await writeAuditLog(admin, {
      eventType: "LOGIN_SUCCESS",
      userId,
      email,
      ipAddress: ip,
      userAgent,
      metadata: { portal: unifiedMode ? "unified" : requestedPortal, role: userRole },
    });

    return jsonResponse({
      message: "Đăng nhập thành công",
      portal: userRole,
      role: userRole,
      accessExpiresIn: ACCESS_TTL_BY_ROLE[userRole],
      refreshExpiresIn: REFRESH_TTL_SECONDS,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      },
    });
  } catch (err) {
    console.error("[portal-login]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "LOGIN_FAILED" }, 500);
  }
});
