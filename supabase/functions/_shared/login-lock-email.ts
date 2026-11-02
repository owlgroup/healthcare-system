import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { getSiteUrl } from "./site-url.ts";

/** AC4: gửi email cảnh báo qua Supabase Auth (reset link) khi khóa tài khoản */
export async function sendAccountLockWarningEmail(
  admin: SupabaseClient,
  email: string,
): Promise<void> {
  const siteUrl = getSiteUrl();

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/forgot-password`,
  });

  if (error) {
    console.error("[login-lock-email]", error.message);
  }
}
