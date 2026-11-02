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

vi.mock("@/lib/cccd-ocr", () => ({
  fetchOcrSingle: vi.fn(),
  mapBhytParsedToInsuranceUpdates: vi.fn(),
  mapCccdParsedToFormUpdates: vi.fn(),
  checkCccdOcrQuality: vi.fn(),
  checkBhytOcrQuality: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import OnboardingFormPage from "@/pages/OnboardingFormPage";

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <OnboardingFormProvider>
        <OnboardingFormPage />
      </OnboardingFormProvider>
    </MemoryRouter>,
  );
}

function labelFor(id: string) {
  return document.querySelector(`label[for="${id}"]`);
}

describe("OnboardingFormPage required field markers (P01-PB-011)", () => {
  it("should show a red asterisk on required identity and name labels", () => {
    renderOnboarding();

    expect(labelFor("idNumber")?.textContent).toMatch(/Số CCCD\s*\*/);
    expect(labelFor("legalFirstName")?.textContent).toMatch(/Họ \(theo giấy tờ\)\s*\*/);
    expect(labelFor("legalLastName")?.textContent).toMatch(/Tên \(theo giấy tờ\)\s*\*/);
    expect(labelFor("dateOfBirth")?.textContent).toMatch(/Ngày sinh\s*\*/);
    expect(labelFor("phoneNumber")?.textContent).toMatch(/Số điện thoại\s*\*/);
    expect(labelFor("emailAddress")?.textContent).toMatch(/Địa chỉ Email\s*\*/);

    expect(labelFor("idNumber")?.querySelector(".text-destructive")?.textContent).toBe("*");
    expect(labelFor("bhytName")?.textContent).toBe("Họ tên (BHYT)");
  });

  it("should label CCCD and BHYT uploads as optional", () => {
    renderOnboarding();

    expect(screen.getByText(/CCCD — mặt trước \(tùy chọn\)/)).toBeInTheDocument();
    expect(screen.getByText(/CCCD — mặt sau \(tùy chọn\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bảo hiểm y tế \(BHYT\) \(tùy chọn\)/)).toBeInTheDocument();
    expect(screen.queryByText(/tải đủ 3 ảnh/)).not.toBeInTheDocument();
  });

  it("should show Vui lòng nhập under empty required fields on submit", () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /Gửi hồ sơ bệnh nhân/ }));

    const requiredIds = [
      "idNumber",
      "expirationDate",
      "residentialAddress",
      "issuedDate",
      "issuer",
      "legalFirstName",
      "legalLastName",
      "dateOfBirth",
      "phoneNumber",
      "emailAddress",
      "insuranceProvider",
      "memberId",
      "groupNumber",
    ];

    for (const id of requiredIds) {
      const field = document.getElementById(id);
      expect(field?.parentElement, id).toHaveTextContent("Vui lòng nhập");
    }

    expect(document.getElementById("bhytName")?.parentElement).not.toHaveTextContent("Vui lòng nhập");
    expect(screen.queryByText(/Vui lòng tải ảnh/)).not.toBeInTheDocument();
  });
});
