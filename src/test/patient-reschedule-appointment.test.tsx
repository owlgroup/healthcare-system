import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import type { Appointment } from "@/types/appointment";

const fetchRescheduleSlots = vi.fn();
const rescheduleAppointment = vi.fn();

vi.mock("@/lib/appointment-api", () => ({
  fetchRescheduleSlots: (...args: unknown[]) => fetchRescheduleSlots(...args),
  rescheduleAppointment: (...args: unknown[]) => rescheduleAppointment(...args),
  mapBookingError: (message: string) => message,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RescheduleAppointmentDialog from "@/components/patient/RescheduleAppointmentDialog";

const tomorrow = addDays(new Date(), 1);
const freeDate = format(tomorrow, "yyyy-MM-dd");

const appointment: Appointment = {
  id: "appt-1",
  patient_id: "p1",
  profile_id: "prof-1",
  specialty_id: "sp-1",
  slot_id: "slot-old",
  status: "CONFIRMED",
  note: null,
  qr_token: "qr",
  qr_expires_at: "",
  reminder_at: "",
  cancelled_at: null,
  created_at: "",
  specialty_name: "Da liễu",
  slot_date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
  start_time: "09:00:00",
  end_time: "09:30:00",
  pre_consult_status: "none",
};

function renderDialog(onRescheduled = vi.fn()) {
  render(
    <RescheduleAppointmentDialog
      appointment={appointment}
      onClose={vi.fn()}
      onRescheduled={onRescheduled}
    />,
  );
  return onRescheduled;
}

describe("RescheduleAppointmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRescheduleSlots.mockResolvedValue([
      { slot_id: "slot-new", slot_date: freeDate, start_time: "14:00:00", end_time: "14:30:00" },
    ]);
    rescheduleAppointment.mockResolvedValue(undefined);
  });

  it("should only enable dates that have free doctor slots", async () => {
    renderDialog();
    const freeDay = await screen.findByRole("button", { name: /1 giờ trống/ });

    expect(freeDay).toBeEnabled();
    expect(fetchRescheduleSlots).toHaveBeenCalledWith("appt-1", expect.any(Date), expect.any(Date));
  });

  it("should require a reason before confirming", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /1 giờ trống/ }));
    fireEvent.click(screen.getByRole("button", { name: "14:00" }));

    const confirm = screen.getByRole("button", { name: /Xác nhận đổi lịch/ });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do đổi lịch/), { target: { value: "   " } });
    expect(confirm).toBeDisabled();
  });

  it("should submit the new slot with the reason when confirmed", async () => {
    const onRescheduled = renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /1 giờ trống/ }));
    fireEvent.click(screen.getByRole("button", { name: "14:00" }));
    fireEvent.change(screen.getByLabelText(/Lý do đổi lịch/), {
      target: { value: "Bận công việc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận đổi lịch/ }));

    await waitFor(() => expect(onRescheduled).toHaveBeenCalled());
    expect(rescheduleAppointment).toHaveBeenCalledWith({
      appointmentId: "appt-1",
      newSlotId: "slot-new",
      reason: "Bận công việc",
    });
  });
});
