import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { clearPendingRegistration } from "../_shared/pending-registration.ts";
import { appendPasswordHistory } from "../_shared/password-history.ts";
import { validatePassword } from "../_shared/password.ts";
import { upsertUserProfile } from "../_shared/user-profile.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

/**
 * Đặt mật khẩu sau khi đã verify OTP (Supabase Auth).
 * Client gửi access_token từ bước verify + password mới.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json() as {
      access_token?: string;
      refresh_token?: string;
      password?: string;
    };
    const access_token = body.access_token?.trim() ?? "";
    const refresh_token = body.refresh_token?.trim() ?? "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!access_token || !refresh_token) {
      return jsonResponse({ error: "INVALID_SESSION" }, 401);
    }

    const rules = validatePassword(password);
    if (!rules.valid) {
      const violated: string[] = [];
      if (!rules.minLength) violated.push("min_length");
      if (!rules.hasUppercase) violated.push("uppercase");
      if (!rules.hasDigit) violated.push("digit");
      return jsonResponse({ error: "WEAK_PASSWORD", rules: violated }, 400);
    }

    const admin = getAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(
      access_token,
    );

    if (userError || !userData.user?.email) {
      return jsonResponse({ error: "INVALID_SESSION" }, 401);
    }

    const email = userData.user.email.toLowerCase();

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userData.user.id,
      { password },
    );

    if (updateError) {
      console.error("[signup-complete] updateUserById");
      return jsonResponse({ error: "PASSWORD_UPDATE_FAILED" }, 500);
    }

    await appendPasswordHistory(admin, userData.user.id, password);
    await upsertUserProfile(admin, userData.user.id, email, "patient");
    await clearPendingRegistration(email);

    const { data: sessionData, error: signInError } = await admin.auth
      .signInWithPassword({ email, password });

    if (signInError || !sessionData.session) {
      return jsonResponse({
        message: "Mật khẩu đã đặt",
        session: {
          access_token,
          refresh_token,
          expires_in: 3600,
          token_type: "bearer",
        },
      }, 201);
    }

    const session = sessionData.session;
    return jsonResponse(
      {
        user: { id: userData.user.id, email },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
        },
      },
      201,
    );
  } catch (err) {
    console.error("[signup-complete]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "COMPLETE_FAILED" }, 500);
  }
});
