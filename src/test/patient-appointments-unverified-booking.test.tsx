import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingBlockedMessage } from "@/lib/appointment-api";

const fetchMyAppointments = vi.fn();
const fetchPatientProfile = vi.fn();
const toastError = vi.fn();
const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/lib/appointment-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/appointment-api")>(
    "@/lib/appointment-api",
  );
  return {
    ...actual,
    fetchMyAppointments: (...args: unknown[]) => fetchMyAppointments(...args),
    fetchPatientProfile: (...args: unknown[]) => fetchPatientProfile(...args),
    cancelAppointment: vi.fn(),
  };
});

vi.mock("@/components/common/QrCodeDisplay", () => ({
  default: () => <div>QR</div>,
}));

import AppointmentsContent from "@/components/AppointmentsContent";

const QA_MESSAGE = bookingBlockedMessage();

describe("AppointmentsContent unverified booking CTA", () => {
  beforeEach(() => {
    fetchMyAppointments.mockReset();
    fetchPatientProfile.mockReset();
    toastError.mockReset();
    navigate.mockReset();
    fetchMyAppointments.mockResolvedValue([]);
    fetchPatientProfile.mockResolvedValue({
      id: "prof-1",
      legal_first_name: "An",
      legal_last_name: "Nguyễn",
      submitted_at: "2026-08-15T00:00:00Z",
      status: "UNVERIFIED",
    });
  });

  it("should not navigate to booking when the profile is UNVERIFIED", async () => {
    render(
      <MemoryRouter>
        <AppointmentsContent />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Đặt lịch ngay" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(QA_MESSAGE);
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
