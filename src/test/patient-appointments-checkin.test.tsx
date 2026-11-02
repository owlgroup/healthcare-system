import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import type { Appointment } from "@/types/appointment";

const fetchMyAppointments = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/lib/appointment-api", () => ({
  fetchMyAppointments: (...args: unknown[]) => fetchMyAppointments(...args),
  cancelAppointment: vi.fn(),
  mapBookingError: (message: string) => message,
  fetchPatientProfile: vi.fn(),
  canPatientSelfBook: () => true,
  bookingBlockedMessage: () => "",
}));

vi.mock("@/components/common/QrCodeDisplay", () => ({
  default: () => <div>QR</div>,
}));

import AppointmentsContent from "@/components/AppointmentsContent";

function confirmedTodayAppointment(): Appointment {
  return {
    id: "appt-1",
    patient_id: "p1",
    profile_id: "prof-1",
    specialty_id: "sp-1",
    slot_id: "slot-1",
    status: "CONFIRMED",
    note: null,
    qr_token: "qr-token",
    qr_expires_at: "2026-08-15T23:59:59Z",
    reminder_at: "2026-08-15T08:00:00Z",
    cancelled_at: null,
    created_at: "2026-08-14T00:00:00Z",
    specialty_name: "Da liễu",
    slot_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "15:00:00",
    end_time: "15:30:00",
    pre_consult_status: "submitted",
  };
}

describe("AppointmentsContent patient check-in", () => {
  beforeEach(() => {
    fetchMyAppointments.mockReset();
    fetchMyAppointments.mockResolvedValue([confirmedTodayAppointment()]);
  });

  it("does not show a check-in button on the patient appointment card", async () => {
    render(
      <MemoryRouter>
        <AppointmentsContent />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Da liễu")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tiếp nhận/i })).not.toBeInTheDocument();
    expect(screen.getByText("Đã khai báo")).toBeInTheDocument();
    expect(screen.getByText("Hủy lịch")).toBeInTheDocument();
  });
});
