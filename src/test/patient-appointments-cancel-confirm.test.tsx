import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import type { Appointment } from "@/types/appointment";

const fetchMyAppointments = vi.fn();
const cancelAppointment = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    role: "patient",
    isLoading: false,
  }),
}));

vi.mock("@/lib/appointment-api", () => ({
  fetchMyAppointments: (...args: unknown[]) => fetchMyAppointments(...args),
  cancelAppointment: (...args: unknown[]) => cancelAppointment(...args),
  mapBookingError: (message: string) => message,
  fetchPatientProfile: vi.fn(),
  canPatientSelfBook: () => true,
  bookingBlockedMessage: () => "",
}));

vi.mock("@/components/common/QrCodeDisplay", () => ({
  default: () => <div>QR</div>,
}));

import AppointmentsContent from "@/components/AppointmentsContent";

function stubPointerCapture() {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

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

describe("AppointmentsContent cancel confirmation", () => {
  beforeEach(() => {
    stubPointerCapture();
    fetchMyAppointments.mockReset();
    cancelAppointment.mockReset();
    fetchMyAppointments.mockResolvedValue([confirmedTodayAppointment()]);
    cancelAppointment.mockResolvedValue(undefined);
  });

  it("should show a confirmation dialog and not cancel when Hủy lịch is clicked", async () => {
    render(
      <MemoryRouter>
        <AppointmentsContent />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Hủy lịch" }));

    expect(
      await screen.findByRole("alertdialog", { name: /Bạn có chắc muốn hủy lịch hẹn này\?/ }),
    ).toBeInTheDocument();
    expect(cancelAppointment).not.toHaveBeenCalled();
    expect(screen.getByText("Chờ khám")).toBeInTheDocument();
  });

  it("should keep the appointment unchanged when the confirmation dialog is dismissed", async () => {
    render(
      <MemoryRouter>
        <AppointmentsContent />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Hủy lịch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Đóng" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(cancelAppointment).not.toHaveBeenCalled();
    expect(screen.getByText("Chờ khám")).toBeInTheDocument();
    expect(screen.queryByText("Đã hủy")).not.toBeInTheDocument();
  });

  it("should cancel the appointment when the confirmation is accepted", async () => {
    render(
      <MemoryRouter>
        <AppointmentsContent />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Hủy lịch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận hủy" }));

    await waitFor(() => {
      expect(cancelAppointment).toHaveBeenCalledOnce();
    });
    expect(cancelAppointment).toHaveBeenCalledWith("appt-1");
    expect(await screen.findByText("Đã hủy")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
