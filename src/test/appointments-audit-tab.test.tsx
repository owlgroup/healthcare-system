import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAppointmentsAuditLog = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/delta-log-api", () => ({
  listAppointmentsAuditLog: (...args: unknown[]) => listAppointmentsAuditLog(...args),
}));

vi.mock("@/components/admin/delta-log/AppointmentDetailDialog", () => ({
  default: () => null,
}));

import AppointmentsAuditTab from "@/components/admin/delta-log/AppointmentsAuditTab";

describe("AppointmentsAuditTab", () => {
  beforeEach(() => {
    listAppointmentsAuditLog.mockReset();
    listAppointmentsAuditLog.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: "audit-1",
          appointment_id: "appt-1",
          action: "CHECKIN",
          performed_by: "doc-1",
          performed_by_name: "Lê Thị Hồng Xoan",
          performed_at: "2026-09-16T02:06:00.000Z",
          old_status: "CONFIRMED",
          new_status: "CHECKED_IN",
          notes: null,
          specialty_name: "Nội tổng quát",
          patient_name: "NGUYỄN NHẬT HÀ",
          doctor_name: "Lê Thị Hồng Xoan",
        },
      ],
    });
  });

  it("should show patient name so admin can tell which visit was logged", async () => {
    render(<AppointmentsAuditTab />);

    expect(await screen.findByPlaceholderText("Tìm kiếm bệnh nhân...")).toBeInTheDocument();
    expect(await screen.findByText("Bệnh nhân")).toBeInTheDocument();
    expect(screen.getAllByText("NGUYỄN NHẬT HÀ").length).toBeGreaterThan(0);
  });
});
