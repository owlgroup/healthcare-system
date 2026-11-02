import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAppointments = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/TopNav", () => ({ default: () => <div>TopNav</div> }));
vi.mock("@/components/Sidebar", () => ({ default: () => <div>Sidebar</div> }));

vi.mock("@/lib/delta-log-api", () => ({
  listPatientAppointmentsAuditLog: (...args: unknown[]) => listAppointments(...args),
}));

vi.mock("@/components/admin/delta-log/AppointmentDetailDialog", () => ({
  default: ({ open, appointmentId }: { open: boolean; appointmentId: string | null }) =>
    open ? <div>Chi tiết lịch hẹn {appointmentId}</div> : null,
}));

import PatientExamHistoryPage from "@/pages/PatientExamHistoryPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientExamHistoryPage />
    </MemoryRouter>,
  );
}

describe("Patient exam history (Rcare Plus)", () => {
  beforeEach(() => {
    listAppointments.mockReset();
    listAppointments.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: "log-1",
          appointment_id: "appt-1",
          action: "CHECKIN",
          performed_by: "staff-1",
          performed_by_name: "Lễ tân",
          performed_at: "2026-09-16T14:30:00.000Z",
          old_status: "CONFIRMED",
          new_status: "CHECKED_IN",
          notes: null,
          specialty_name: "Da liễu",
          patient_name: "BỆNH NHÂN KHÁC",
          doctor_name: "Lê Thị Hồng Xoan",
        },
      ],
    });
  });

  it("should show visit history without the system log tab", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Lịch sử khám bệnh" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Nhật ký hệ thống/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Lịch sử khám bệnh/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm chuyên khoa, bác sĩ...")).toBeInTheDocument();
    expect((await screen.findAllByText("Lê Thị Hồng Xoan")).length).toBeGreaterThan(0);
    expect(screen.queryByText("BỆNH NHÂN KHÁC")).not.toBeInTheDocument();
    expect(screen.getAllByText("Da liễu").length).toBeGreaterThan(0);
  });

  it("should open appointment details from the visit list", async () => {
    renderPage();

    const detailButtons = await screen.findAllByRole("button", { name: /Xem chi tiết/i });
    fireEvent.click(detailButtons[0]);

    expect(await screen.findByText("Chi tiết lịch hẹn appt-1")).toBeInTheDocument();
  });
});
