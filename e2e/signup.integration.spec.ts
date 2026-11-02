import { test, expect } from "@playwright/test";

/**
 * Chạy khi Supabase + Edge Functions đang bật:
 *   SIGNUP_E2E=true npm run test:e2e -- e2e/signup.integration.spec.ts
 *
 * OTP đọc từ log functions khi SIGNUP_DEV_LOG_OTP=true.
 */
const runIntegration = process.env.SIGNUP_E2E === "true";
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

test.describe("Signup integration (live Supabase)", () => {
  test.skip(!runIntegration, "Set SIGNUP_E2E=true to run live signup tests");

  test("send-otp endpoint responds", async ({ request }) => {
    test.skip(!supabaseUrl || !anonKey, "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");

    const email = `e2e.${Date.now()}@example.com`;
    const res = await request.post(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/signup-send-otp`,
      {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        data: { email },
      },
    );

    expect([200, 409]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.expiresInSeconds).toBe(300);
    }
  });
});
