import type { Page } from "@playwright/test";

const TEST_EMAIL = "e2e.signup@example.com";
const TEST_OTP = "123456";
const FAKE_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtdXNlciIsImVtYWlsIjoiZTJlQGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9.e2e-fake-signature";
const FAKE_REFRESH_TOKEN = "e2e-refresh-token";

export const signupTestData = {
  email: TEST_EMAIL,
  otp: TEST_OTP,
  password: "Secret12",
};

type MockOptions = {
  emailExists?: boolean;
  otpInvalid?: boolean;
  otpLocked?: boolean;
};

export async function mockSignupApis(page: Page, options: MockOptions = {}) {
  await page.route("**/functions/v1/signup-send-otp", async (route) => {
    if (options.emailExists) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "EMAIL_EXISTS",
          message: "Tài khoản đã tồn tại",
          suggestions: ["login", "forgot_password"],
        }),
      });
      return;
    }
    if (options.otpLocked) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "OTP_LOCKED",
          retryAfter: 300,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "OTP đã gửi",
        expiresIn: 300,
      }),
    });
  });

  await page.route("**/auth/v1/otp**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/functions/v1/signup-verify-otp", async (route) => {
    const payload = route.request().postDataJSON() as { otp?: string };
    if (options.otpInvalid || payload.otp !== TEST_OTP) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_OTP",
          attemptsLeft: 2,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "OK",
        needsPassword: true,
        session: {
          access_token: FAKE_ACCESS_TOKEN,
          refresh_token: FAKE_REFRESH_TOKEN,
          expires_in: 3600,
          token_type: "bearer",
        },
      }),
    });
  });

  await page.route("**/functions/v1/signup-complete", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "00000000-0000-0000-0000-0000000000e2", email: TEST_EMAIL },
        session: {
          access_token: FAKE_ACCESS_TOKEN,
          refresh_token: FAKE_REFRESH_TOKEN,
          expires_in: 3600,
          token_type: "bearer",
        },
      }),
    });
  });

  const authUser = {
    id: "00000000-0000-0000-0000-0000000000e2",
    aud: "authenticated",
    role: "authenticated",
    email: TEST_EMAIL,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await page.route("**/auth/v1/verify**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const payload = route.request().postDataJSON() as { token?: string };
    if (options.otpInvalid || payload.token !== TEST_OTP) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_token",
          error_description: "Invalid OTP",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: FAKE_ACCESS_TOKEN,
        refresh_token: FAKE_REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "bearer",
        user: authUser,
      }),
    });
  });

  await page.route("**/auth/v1/user**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authUser),
    });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: FAKE_ACCESS_TOKEN,
        refresh_token: FAKE_REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "bearer",
        user: authUser,
      }),
    });
  });
}

/** E2E: bỏ qua OTP, vào thẳng bước mật khẩu (dev). */
export async function skipToPasswordStep(page: Page) {
  const qs = new URLSearchParams({
    e2e: "password",
    email: TEST_EMAIL,
  });
  await page.goto(`/signup?${qs.toString()}`);
  await page.getByRole("heading", { level: 2, name: /Bước 3/i }).waitFor({
    timeout: 10_000,
  });
}
