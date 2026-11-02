import { test, expect, type Page } from "@playwright/test";

const FAKE_ACCESS =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtdXNlciIsInVzZXJfcm9sZSI6InBhdGllbnQiLCJleHAiOjk5OTk5OTk5OTl9.e2e";

async function mockPatientSession(page: Page) {
  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-0000000000e2",
        email: "patient@example.com",
        app_metadata: { role: "patient" },
      }),
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
        access_token: FAKE_ACCESS,
        refresh_token: "e2e-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-0000-0000-0000000000e2",
          email: "patient@example.com",
          app_metadata: { role: "patient" },
        },
      }),
    });
  });

  await page.route("**/functions/v1/patient-dob-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ verified: true, locked: false, retryAfter: null }),
    });
  });

  await page.route("**/rest/v1/patient**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/rest/v1/patient_emergency_contacts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/rest/v1/patient_medical_charts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route("**/rest/v1/patient_account_settings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route("**/rest/v1/rpc/get_my_care_team**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/rest/v1/rpc/get_my_vitals_summary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        blood_pressure: { systolic: null, diastolic: null, recorded_at: null, source: null },
        weight: { kg: null, recorded_at: null, source: null },
        height: { cm: null, bmi: null, source: null },
        temperature: { celsius: null, recorded_at: null, source: null },
      }),
    });
  });

  await page.addInitScript(() => {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token")) ?? "sb-auth-token";
    localStorage.setItem(
      key,
      JSON.stringify({
        currentSession: {
          access_token: "e2e-token",
          refresh_token: "e2e-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "00000000-0000-0000-0000-0000000000e2",
            email: "patient@example.com",
            app_metadata: { role: "patient" },
          },
        },
      }),
    );
  });
}

test.describe("Patient account hub", () => {
  test("/account redirects to personal info tab", async ({ page }) => {
    await mockPatientSession(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/personal$/);
    await expect(page.getByRole("heading", { name: /Quản lý/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thông tin cá nhân" })).toBeVisible();
  });

  test("sub-navigation switches tabs", async ({ page }) => {
    await mockPatientSession(page);
    await page.goto("/account/personal");

    await page.getByRole("link", { name: "Bảo hiểm" }).click();
    await expect(page).toHaveURL(/\/account\/insurance$/);
    await expect(page.getByRole("heading", { name: "Bảo hiểm (BHYT)" })).toBeVisible();

    await page.getByRole("link", { name: "Cài đặt chung" }).click();
    await expect(page).toHaveURL(/\/account\/settings$/);
    await expect(page.getByRole("heading", { name: "Cài đặt & Bảo mật" })).toBeVisible();
  });

  test("personal tab shows empty state without profile", async ({ page }) => {
    await mockPatientSession(page);
    await page.goto("/account/personal");
    await expect(page.getByText("Chưa có dữ liệu")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tạo hồ sơ bằng AI" })).toBeVisible();
  });
});
