import { test, expect } from "@playwright/test";
import {
  mockUnifiedLoginApis,
  patientDobTestData,
  portalLoginTestData,
} from "./helpers/portal-login-mocks";

test.describe("Patient DOB login verification", () => {
  test("patient login shows DOB step before session", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.patient.email);
    await page.locator("#password").fill(portalLoginTestData.patient.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("heading", { name: "Xác nhận ngày sinh" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("correct DOB completes login and grants access to home", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.patient.email);
    await page.locator("#password").fill(portalLoginTestData.patient.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await page.locator("#login-dob").fill(patientDobTestData.correctDob);
    await page.getByRole("button", { name: "Xác nhận và đăng nhập" }).click();

    await expect(page).toHaveURL(/\/home/);
  });

  test("wrong DOB shows error on login step", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.patient.email);
    await page.locator("#password").fill(portalLoginTestData.patient.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await page.locator("#login-dob").fill(patientDobTestData.wrongDob);
    await page.getByRole("button", { name: "Xác nhận và đăng nhập" }).click();

    await expect(page.getByRole("alert")).toContainText(/không khớp/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("doctor login bypasses DOB step", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.doctor.email);
    await page.locator("#password").fill(portalLoginTestData.doctor.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/provider-portal\/dashboard/);
    await expect(page.getByRole("heading", { name: "Xác nhận ngày sinh" })).not.toBeVisible();
  });
});
