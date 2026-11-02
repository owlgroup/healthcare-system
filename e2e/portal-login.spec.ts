import { test, expect } from "@playwright/test";
import {
  mockUnifiedLoginApis,
  portalLoginTestData,
} from "./helpers/portal-login-mocks";

test.describe("Unified login", () => {
  test("login page renders at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Đăng nhập Rcare Plus/i })).toBeVisible();
  });

  test("legacy portal URLs redirect to /login", async ({ page }) => {
    await page.goto("/patient/login");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/doctor/login");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("patient login requires DOB step on login page", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.patient.email);
    await page.locator("#password").fill(portalLoginTestData.patient.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("heading", { name: "Xác nhận ngày sinh" })).toBeVisible();
  });

  test("doctor redirects to provider portal", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.doctor.email);
    await page.locator("#password").fill(portalLoginTestData.doctor.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/provider-portal\/dashboard/);
  });

  test("admin redirects to patient records", async ({ page }) => {
    await mockUnifiedLoginApis(page);
    await page.goto("/login");

    await page.locator("#email").fill(portalLoginTestData.admin.email);
    await page.locator("#password").fill(portalLoginTestData.admin.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/admin\/patient-records/);
  });

  test("invalid credentials shows error", async ({ page }) => {
    await mockUnifiedLoginApis(page, { invalidCredentials: true });
    await page.goto("/login");

    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("bad");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("alert")).toContainText(/không đúng/i);
  });
});
