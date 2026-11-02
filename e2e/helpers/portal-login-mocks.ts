import type { Page } from "@playwright/test";

const FAKE_ACCESS =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtdXNlciIsInVzZXJfcm9sZSI6InBhdGllbnQiLCJleHAiOjk5OTk5OTk5OTl9.e2e";
const FAKE_REFRESH = "e2e-refresh-token";

export const portalLoginTestData = {
  patient: { email: "patient@example.com", password: "Secret12", role: "patient" },
  doctor: { email: "doctor@example.com", password: "Secret12", role: "doctor" },
  admin: { email: "admin@example.com", password: "Secret12", role: "admin" },
};

export const patientDobTestData = {
  correctDob: "1990-05-15",
  wrongDob: "2000-01-01",
};

type MockOptions = {
  invalidCredentials?: boolean;
  locked?: boolean;
  noProfile?: boolean;
  skipPatientDob?: boolean;
};

function roleFromEmail(email: string): "patient" | "doctor" | "admin" {
  if (email.includes("doctor")) return "doctor";
  if (email.includes("admin")) return "admin";
  return "patient";
}

export async function mockUnifiedLoginApis(
  page: Page,
  options: MockOptions = {},
) {
  await page.route("**/functions/v1/portal-login", async (route) => {
    const payload = route.request().postDataJSON() as {
      portal?: string;
      email?: string;
      date_of_birth?: string;
    };

    if (options.locked) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "ACCOUNT_LOCKED",
          message: "Tài khoản tạm khóa",
          retryAfter: 900,
        }),
      });
      return;
    }

    if (options.invalidCredentials) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_CREDENTIALS",
          message: "Email hoặc mật khẩu không đúng",
          attemptsLeft: 3,
        }),
      });
      return;
    }

    if (options.noProfile) {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "PROFILE_NOT_FOUND",
          message: "Chưa có hồ sơ user",
        }),
      });
      return;
    }

    const role = roleFromEmail(payload.email ?? "");

    if (role === "patient" && !options.skipPatientDob) {
      if (!payload.date_of_birth) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requiresDob: true,
            message: "Vui lòng nhập ngày sinh để hoàn tất đăng nhập",
          }),
        });
        return;
      }

      if (payload.date_of_birth !== patientDobTestData.correctDob) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: "DOB_MISMATCH",
            message: "Ngày sinh không khớp với hồ sơ. Vui lòng thử lại.",
            attemptsLeft: 2,
          }),
        });
        return;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "OK",
        portal: role,
        role,
        accessExpiresIn: 3600,
        refreshExpiresIn: 604800,
        session: {
          access_token: FAKE_ACCESS,
          refresh_token: FAKE_REFRESH,
          expires_in: 3600,
          token_type: "bearer",
        },
      }),
    });
  });

  await page.route("**/functions/v1/portal-logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "OK" }),
    });
  });

  await page.route("**/functions/v1/patient-dob-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        verified: true,
        locked: false,
        retryAfter: null,
        requiresOnboarding: false,
      }),
    });
  });

  await page.route("**/auth/v1/token**", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const payload = route.request().postDataJSON() as { email?: string };
    const role = roleFromEmail(payload?.email ?? "patient@example.com");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: FAKE_ACCESS,
        refresh_token: FAKE_REFRESH,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-0000-0000-0000000000e2",
          email: payload?.email ?? "patient@example.com",
          app_metadata: { role },
        },
      }),
    });
  });
}

/** @deprecated use mockUnifiedLoginApis */
export async function mockPortalLoginApis(
  page: Page,
  portal: "patient" | "doctor" | "admin",
  options: MockOptions = {},
) {
  await mockUnifiedLoginApis(page, options);
  void portal;
}
