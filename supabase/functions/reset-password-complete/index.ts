import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  appendPasswordHistory,
  isPasswordInRecentHistory,
} from "../_shared/password-history.ts";
import { validatePassword } from "../_shared/password.ts";
import {
  getRedis,
  resetTokenUsedKey,
  TEMP_TOKEN_TTL_SECONDS,
} from "../_shared/redis.ts";
import { verifyResetToken } from "../_shared/reset-token.ts";
import {
  getAdminClient,
  signOutAllSessions,
} from "../_shared/supabase-admin.ts";

/**
 * AC3: mật khẩu mới ≠ 3 password gần nhất
 * AC4: vô hiệu hóa mọi refresh token
 * AC5: audit PASSWORD_RESET
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const body = await req.json() as {
      reset_token?: string;
      password?: string;
    };
    const reset_token = body.reset_token?.trim() ?? "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!reset_token) {
      return jsonResponse(
        { error: "INVALID_RESET_TOKEN", message: "Phiên reset không hợp lệ" },
        401,
      );
    }

    const rules = validatePassword(password);
    if (!rules.valid) {
      const violated: string[] = [];
      if (!rules.minLength) violated.push("min_length");
      if (!rules.hasUppercase) violated.push("uppercase");
      if (!rules.hasDigit) violated.push("digit");
      return jsonResponse({ error: "WEAK_PASSWORD", rules: violated }, 400);
    }

    const payload = await verifyResetToken(reset_token);
    if (!payload) {
      return jsonResponse(
        {
          error: "INVALID_RESET_TOKEN",
          message: "Token hết hạn hoặc không hợp lệ. Bắt đầu lại từ bước email.",
        },
        401,
      );
    }

    const redis = getRedis();
    const used = await redis.get(resetTokenUsedKey(payload.jti));
    if (used) {
      return jsonResponse(
        { error: "RESET_TOKEN_USED", message: "Token đã được sử dụng" },
        401,
      );
    }

    const admin = getAdminClient();

    const reused = await isPasswordInRecentHistory(
      admin,
      payload.userId,
      password,
    );
    if (reused) {
      await writeAuditLog(admin, {
        eventType: "PASSWORD_RESET_FAILED",
        userId: payload.userId,
        email: payload.email,
        ipAddress: ip,
        userAgent,
        metadata: { reason: "password_reused" },
      });
      return jsonResponse(
        {
          error: "PASSWORD_REUSED",
          message: "Mật khẩu mới không được trùng 3 mật khẩu gần nhất",
        },
        400,
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      payload.userId,
      { password },
    );

    if (updateError) {
      console.error("[reset-password-complete] updateUserById", updateError.message);
      return jsonResponse(
        {
          error: "PASSWORD_UPDATE_FAILED",
          message: updateError.message || "Không cập nhật được mật khẩu",
        },
        500,
      );
    }

    await appendPasswordHistory(admin, payload.userId, password);

    await redis.set(resetTokenUsedKey(payload.jti), "1", {
      ex: TEMP_TOKEN_TTL_SECONDS,
    });

    await signOutAllSessions(payload.userId);

    await writeAuditLog(admin, {
      eventType: "PASSWORD_RESET",
      userId: payload.userId,
      email: payload.email,
      ipAddress: ip,
      userAgent,
      metadata: { sessions_revoked: true },
    });

    return jsonResponse({
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    console.error("[reset-password-complete]", detail);
    return jsonResponse(
      {
        error: "RESET_FAILED",
        message: "Không thể đặt lại mật khẩu. Thử lại hoặc bắt đầu lại từ bước email.",
      },
      500,
    );
  }
});
