import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationPanel from "@/components/admin/NotificationPanel";
import type { AppointmentNotification } from "@/hooks/useAdminNotifications";

const rescheduled: AppointmentNotification = {
  id: "n-1",
  appointmentId: "appt-1",
  patientName: "Phạm Đức Hậu",
  specialtyName: "Da liễu",
  slotDate: "2026-11-20",
  startTime: "14:00:00",
  walkIn: false,
  createdAt: new Date().toISOString(),
  read: false,
  kind: "RESCHEDULED",
  previousSlotDate: "2026-11-16",
  previousStartTime: "08:30:00",
  reason: "Bận công việc đột xuất",
};

function openPanel(notifications: AppointmentNotification[]) {
  render(
    <MemoryRouter>
      <NotificationPanel
        notifications={notifications}
        unreadCount={1}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
        onClearAll={vi.fn()}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: /thông báo mới/ }));
}

describe("NotificationPanel", () => {
  it("should show old slot, new slot and reason when the patient rescheduled", () => {
    openPanel([rescheduled]);

    expect(screen.getByText("Bệnh nhân đổi lịch hẹn")).toBeInTheDocument();
    expect(screen.getByText("08:30 · 16/11/2026")).toBeInTheDocument();
    expect(screen.getByText(/→ 14:00 · 20\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Lý do: Bận công việc đột xuất")).toBeInTheDocument();
  });

  it("should keep the new-appointment layout when kind is missing", () => {
    openPanel([{ ...rescheduled, kind: undefined, reason: null }]);

    expect(screen.queryByText("Bệnh nhân đổi lịch hẹn")).not.toBeInTheDocument();
    expect(screen.getByText("Da liễu · 14:00 · 20/11/2026")).toBeInTheDocument();
  });
});
