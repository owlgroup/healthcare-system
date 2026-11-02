import type { Page } from "@playwright/test";

const TEST_EMAIL = "e2e.reset@example.com";
const TEST_OTP = "654321";
export const RESET_TOKEN = "e2e-reset-token-jwt";

export const resetTestData = {
  email: TEST_EMAIL,
  otp: TEST_OTP,
  password: "NewPass99",
  oldPassword: "OldPass99",
};

type MockOptions = {
  otpInvalid?: boolean;
  passwordReused?: boolean;
};

export async function mockResetApis(page: Page, options: MockOptions = {}) {
  await page.route("**/functions/v1/forgot-password-send-otp", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Nếu email đã đăng ký, mã OTP đã được gửi.",
        expiresIn: 300,
      }),
    });
  });

  await page.route("**/functions/v1/forgot-password-verify-otp", async (route) => {
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
        reset_token: RESET_TOKEN,
        expiresIn: 600,
      }),
    });
  });

  await page.route("**/functions/v1/reset-password-complete", async (route) => {
    if (options.passwordReused) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "PASSWORD_REUSED",
          message: "Mật khẩu mới không được trùng 3 mật khẩu gần nhất",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Đặt lại mật khẩu thành công",
      }),
    });
  });
}
