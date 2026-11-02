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

function fillMismatch() {
  fireEvent.change(document.getElementById("legalLastName") as HTMLInputElement, {
    target: { value: "NGUYỄN" },
  });
  fireEvent.change(document.getElementById("legalFirstName") as HTMLInputElement, {
    target: { value: "TẤN PHÁT" },
  });
  fireEvent.change(document.getElementById("dateOfBirth") as HTMLInputElement, {
    target: { value: "1990-01-15" },
  });
  fireEvent.change(document.getElementById("bhytName") as HTMLInputElement, {
    target: { value: "TRỊNH XUÂN ĐOÀN" },
  });
  fireEvent.change(document.getElementById("bhytDob") as HTMLInputElement, {
    target: { value: "1990-01-15" },
  });
}

describe("OnboardingFormPage CCCD–BHYT cross-validation", () => {
  it("should not show a mismatch banner when BHYT name and DOB are empty", () => {
    renderOnboarding();
    fireEvent.change(document.getElementById("legalLastName") as HTMLInputElement, {
      target: { value: "NGUYỄN" },
    });
    fireEvent.change(document.getElementById("legalFirstName") as HTMLInputElement, {
      target: { value: "TẤN PHÁT" },
    });
    expect(screen.queryByText(/CCCD và thẻ BHYT không khớp/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi hồ sơ bệnh nhân/ })).not.toBeDisabled();
  });

  it("should show a red warning and disable submit when names do not match", () => {
    renderOnboarding();
    fillMismatch();

    expect(screen.getByText(/CCCD và thẻ BHYT không khớp/)).toBeInTheDocument();
    expect(screen.getByText(/NGUYỄN TẤN PHÁT/)).toBeInTheDocument();
    expect(screen.getByText(/TRỊNH XUÂN ĐOÀN/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi hồ sơ bệnh nhân/ })).toBeDisabled();
  });

  it("should enable submit after the user confirms the mismatch", () => {
    renderOnboarding();
    fillMismatch();

    fireEvent.click(screen.getByRole("button", { name: /Xác nhận thông tin khác nhau/ }));

    expect(screen.getByText(/Bạn đã xác nhận tiếp tục/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi hồ sơ bệnh nhân/ })).not.toBeDisabled();
  });

  it("should re-block submit when compared values change after confirmation", () => {
    renderOnboarding();
    fillMismatch();
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận thông tin khác nhau/ }));

    fireEvent.change(document.getElementById("bhytName") as HTMLInputElement, {
      target: { value: "LÊ THỊ HOA" },
    });

    expect(screen.getByRole("button", { name: /Xác nhận thông tin khác nhau/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi hồ sơ bệnh nhân/ })).toBeDisabled();
  });
});
