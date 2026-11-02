import { test, expect } from "@playwright/test";
import { mockSignupApis, signupTestData } from "./helpers/signup-mocks";

test.describe("Signup 3-step flow (signInWithOtp)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSignupApis(page);
    await page.goto("/signup");
  });

  test("completes email → OTP → password and lands on onboarding", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 2, name: /Bước 1/i })).toBeVisible();

    await page.locator("#email").fill(signupTestData.email);
    await page.getByRole("checkbox", { name: /đồng ý/i }).click();
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    await expect(page.getByRole("heading", { level: 2, name: /Bước 2/i })).toBeVisible();
    await expect(page.getByText(signupTestData.email)).toBeVisible();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill(signupTestData.otp);
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    await expect(page.getByRole("heading", { level: 2, name: /Bước 3/i })).toBeVisible();
    await page.locator("#password").fill(signupTestData.password);
    await page.locator("#confirm-password").fill(signupTestData.password);
    await page.getByRole("button", { name: "Hoàn tất đăng ký" }).click();

    await expect(page).toHaveURL(/\/onboarding\/profile/);
  });

  test("requires terms consent before sending OTP", async ({ page }) => {
    await page.locator("#email").fill(signupTestData.email);
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    await expect(page.getByRole("alert")).toContainText(/đồng ý/i);
    await expect(page.getByRole("heading", { level: 2, name: /Bước 1/i })).toBeVisible();
  });

  test("shows inline password rules and disables submit until valid", async ({
    page,
  }) => {
    await page.locator("#email").fill(signupTestData.email);
    await page.getByRole("checkbox", { name: /đồng ý/i }).click();
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill(signupTestData.otp);
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    const submit = page.getByRole("button", { name: "Hoàn tất đăng ký" });
    await expect(submit).toBeDisabled();

    await page.locator("#password").fill("short");
    await expect(page.getByText("Ít nhất 8 ký tự")).toBeVisible();
    await expect(submit).toBeDisabled();

    await page.locator("#password").fill(signupTestData.password);
    await page.locator("#confirm-password").fill(signupTestData.password);
    await expect(page.getByText("✓ Ít nhất 8 ký tự")).toBeVisible();
    await expect(page.getByText(/✓.*chữ hoa/i)).toBeVisible();
    await expect(page.getByText(/✓.*chữ số/i)).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test("shows login hint when email already exists", async ({ page }) => {
    await mockSignupApis(page, { emailExists: true });
    await page.goto("/signup");

    await page.locator("#email").fill("existing@example.com");
    await page.getByRole("checkbox", { name: /đồng ý/i }).click();
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText(/tồn tại/i);
    await expect(alert.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  });

  test("shows error on invalid OTP", async ({ page }) => {
    await page.locator("#email").fill(signupTestData.email);
    await page.getByRole("checkbox", { name: /đồng ý/i }).click();
    await page.getByRole("button", { name: "Gửi mã OTP" }).click();

    const otpInput = page
      .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]')
      .first();
    await otpInput.fill("000000");
    await page.getByRole("button", { name: "Xác minh OTP" }).click();

    await expect(page.getByRole("alert")).toContainText(/OTP không đúng|không đúng/i);
    await expect(page.getByRole("heading", { level: 2, name: /Bước 2/i })).toBeVisible();
  });
});
