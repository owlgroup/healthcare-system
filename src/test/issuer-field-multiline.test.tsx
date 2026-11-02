import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingFormProvider } from "@/hooks/useOnboardingForm";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useDuplicateCheck", () => ({
  useDuplicateCheck: () => ({
    dupState: { cccdMatchId: null, phoneMatchId: null, nameDobMatchId: null },
    bypassed: { phone: false, nameDob: false },
    checking: false,
    isBlocked: false,
    hasUnbypassedWarning: false,
    checkCccd: vi.fn(),
    checkPhone: vi.fn(),
    checkNameDob: vi.fn(),
    checkAll: vi.fn(),
    bypassPhone: vi.fn(),
    bypassNameDob: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/lib/patient-onboarding", () => ({
  submitPatientProfile: vi.fn(),
}));

vi.mock("@/lib/cccd-ocr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cccd-ocr")>();
  return {
    ...actual,
    fetchOcrSingle: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ upsert: vi.fn() }),
    storage: { from: () => ({ upload: vi.fn() }) },
  },
}));

vi.mock("@/lib/admin-api", () => ({
  createAdminUser: vi.fn(),
  listAdminRoles: vi.fn(),
}));

vi.mock("@/lib/admin-appointment-api", () => ({
  adminInsertPatientProfile: vi.fn(),
  staffCreatePatientProfile: vi.fn(),
}));

vi.mock("@/lib/duplicate-check", () => ({
  checkPatientDuplicate: vi.fn(),
  logDedupAudit: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import OnboardingFormPage from "@/pages/OnboardingFormPage";
import AdminNewPatientDialog from "@/components/admin/patients/AdminNewPatientDialog";

const LONG_ISSUER = "CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI";

function assertIssuerTextarea() {
  const field = document.getElementById("issuer");
  expect(field).toBeInstanceOf(HTMLTextAreaElement);
  expect(field?.tagName).toBe("TEXTAREA");
  expect(labelFor("issuer")?.textContent).toMatch(/Nơi cấp/);

  fireEvent.change(field!, { target: { value: LONG_ISSUER } });
  expect(field).toHaveDisplayValue(LONG_ISSUER);
  expect(field).toHaveClass("overflow-y-auto", "resize-none");
}

function labelFor(id: string) {
  return document.querySelector(`label[for="${id}"]`);
}

describe("Nơi cấp issuer field multiline display", () => {
  it("should render onboarding Nơi cấp as a wrapping textarea that shows the full OCR issuer string", () => {
    render(
      <MemoryRouter>
        <OnboardingFormProvider>
          <OnboardingFormPage />
        </OnboardingFormProvider>
      </MemoryRouter>,
    );

    assertIssuerTextarea();
  });

  it("should render admin new-patient Nơi cấp as a wrapping textarea that shows the full OCR issuer string", () => {
    render(<AdminNewPatientDialog open onClose={() => undefined} onSuccess={() => undefined} />);

    assertIssuerTextarea();
    expect(screen.getByLabelText(/Nơi cấp/)).toBe(document.getElementById("issuer"));
  });
});
