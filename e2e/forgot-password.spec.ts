import { test, expect } from "@playwright/test";
import { mockResetApis, resetTestData } from "./helpers/reset-mocks";

test.describe("Forgot password FR-003", () => {
  test.beforeEach(async ({ page }) => {
    await mockResetApis(page);
    await page.goto("/forgot-password");
  });

  test("completes email → OTP → new password → login", async ({ page }) => {
    await page.locator("#email").fill(resetTestData.email);
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    await expect(page.getByRole("heading", { name: /Xác minh OTP/i })).toBeVisible();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill(resetTestData.otp);
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    await expect(page.getByRole("heading", { name: /Mật khẩu mới/i })).toBeVisible();
    await page.locator("#password").fill(resetTestData.password);
    await page.locator("#confirm-password").fill(resetTestData.password);
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error on invalid OTP", async ({ page }) => {
    await page.locator("#email").fill(resetTestData.email);
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill("000000");
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    await expect(page.getByRole("alert")).toContainText(/OTP không đúng/i);
  });

  test("shows password reused error", async ({ page }) => {
    await mockResetApis(page, { passwordReused: true });
    await page.goto("/forgot-password");

    await page.locator("#email").fill(resetTestData.email);
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill(resetTestData.otp);
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    await page.locator("#password").fill(resetTestData.oldPassword);
    await page.locator("#confirm-password").fill(resetTestData.oldPassword);
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

    await expect(page.getByRole("alert")).toContainText(/3 mật khẩu gần nhất/i);
  });
});
