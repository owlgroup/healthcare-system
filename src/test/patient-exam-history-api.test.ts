import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import {
  listPatientAppointmentsAuditLog,
  listPatientExaminationActivityLog,
} from "@/lib/delta-log-api";

describe("patient exam history RPCs", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("should map FORBIDDEN to a Vietnamese access message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "FORBIDDEN" } });

    await expect(listPatientAppointmentsAuditLog()).rejects.toThrow(
      "Bạn không có quyền truy cập.",
    );
    expect(rpc).toHaveBeenCalledWith(
      "list_patient_appointments_audit_log",
      expect.objectContaining({ p_page: 1, p_limit: 10 }),
    );
  });

  it("should surface UNAUTHORIZED from the exam activity RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "UNAUTHORIZED" } });

    await expect(listPatientExaminationActivityLog()).rejects.toThrow("UNAUTHORIZED");
    expect(rpc).toHaveBeenCalledWith(
      "list_patient_examination_activity_log",
      expect.objectContaining({ p_query: null, p_page: 1, p_limit: 10 }),
    );
  });

  it("should map patient appointment audit rows", async () => {
    rpc.mockResolvedValue({
      data: {
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
            patient_name: "ĐỨC HẦU PHẠM",
            doctor_name: "Lê Thị Hồng Xoan",
          },
        ],
      },
      error: null,
    });

    const result = await listPatientAppointmentsAuditLog({ search: "Da liễu", page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.rows[0].doctor_name).toBe("Lê Thị Hồng Xoan");
    expect(result.rows[0].action).toBe("CHECKIN");
  });
});
