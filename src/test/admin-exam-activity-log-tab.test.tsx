import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { format, parseISO } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAppointmentsAuditLog = vi.fn();
const listAdminExamLogs = vi.fn();
const getExamById = vi.fn();
const listExamActivity = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/delta-log-api", () => ({
  listAppointmentsAuditLog: (...args: unknown[]) => listAppointmentsAuditLog(...args),
  listAdminExaminationActivityLog: (...args: unknown[]) => listAdminExamLogs(...args),
  listSystemAuditLog: vi.fn().mockResolvedValue({ total: 0, rows: [] }),
  listSignatureLogs: vi.fn().mockResolvedValue({ total: 0, rows: [] }),
}));

vi.mock("@/lib/emr-api", () => ({
  getExaminationById: (...args: unknown[]) => getExamById(...args),
  listExaminationActivityLog: (...args: unknown[]) => listExamActivity(...args),
}));

vi.mock("@/components/admin/delta-log/AppointmentDetailDialog", () => ({
  default: () => null,
}));

import DeltaLogPage from "@/pages/admin/DeltaLogPage";

describe("Admin exam activity log tab", () => {
  beforeEach(() => {
    listAppointmentsAuditLog.mockReset();
    listAdminExamLogs.mockReset();
    getExamById.mockReset();
    listExamActivity.mockReset();
    listExamActivity.mockResolvedValue([]);
    listAppointmentsAuditLog.mockResolvedValue({ total: 0, rows: [] });
    listAdminExamLogs.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: "log-1",
          exam_id: "exam-1",
          actor_id: "doc-1",
          actor_name: "Lê Thị Hồng Xoan",
          action: "UPDATED",
          created_at: "2026-09-16T10:15:00.000Z",
          patient_name: "NGUYỄN NHẬT HÀ",
          appointment_id: "appt-1",
          message: "Bác sĩ Lê Thị Hồng Xoan đã cập nhật nội dung hồ sơ",
          changed_fields: ["s_text", "a_text"],
          related_exam_id: null,
        },
      ],
    });
    getExamById.mockResolvedValue({
      id: "exam-1",
      appointment_id: "appt-1",
      patient_id: "user-1",
      doctor_id: "doc-1",
      s_text: "Đau họng 3 ngày",
      o_text: "Họng đỏ",
      a_text: "Viêm họng cấp",
      p_text: "Nghỉ ngơi, uống nhiều nước",
      status: "DRAFT",
      is_addendum: false,
      parent_exam_id: null,
      auto_saved_at: null,
      created_at: "2026-09-16T00:00:00.000Z",
      updated_at: "2026-09-16T03:14:00.000Z",
      ai_baseline: {
        s_text: "Đau họng",
        o_text: "Họng đỏ",
        a_text: "Viêm họng",
        p_text: "Nghỉ ngơi, uống nhiều nước",
      },
      icd_codes: [
        {
          id: "icd-1",
          exam_id: "exam-1",
          icd_code: "J02.9",
          icd_name: "Viêm họng cấp",
          is_ai_suggested: false,
          ai_confidence: null,
          ai_reason: null,
          confirm_status: "CONFIRMED",
          confirmed_at: "2026-09-16T03:14:00.000Z",
          display_order: 0,
          created_at: "2026-09-16T03:14:00.000Z",
        },
      ],
    });
  });

  it("should show a Nhật ký hồ sơ tab with the exam update trail and doctor name", async () => {
    render(<DeltaLogPage />);

    const tab = screen.getByRole("tab", { name: /Nhật ký hồ sơ/i });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);

    await waitFor(() => {
      expect(listAdminExamLogs).toHaveBeenCalled();
    });

    expect(
      await screen.findAllByText("Bác sĩ Lê Thị Hồng Xoan đã cập nhật nội dung hồ sơ"),
    ).not.toHaveLength(0);
    expect(screen.getAllByText("NGUYỄN NHẬT HÀ").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: /Bác sĩ/i })).toBeInTheDocument();
    expect(screen.getAllByText("Lê Thị Hồng Xoan").length).toBeGreaterThan(0);
  });

  it("should open SOAP details when clicking Xem chi tiết", async () => {
    listExamActivity.mockResolvedValue([
      {
        id: "ai-1",
        exam_id: "exam-1",
        actor_id: "doc-1",
        actor_name: "Lê Thị Hồng Xoan",
        action: "AI_GENERATED",
        created_at: "2026-09-16T03:00:00.000Z",
        message: "Bác sĩ Lê Thị Hồng Xoan đã tạo nháp SOAP bằng AI",
        changed_fields: [],
        related_exam_id: null,
      },
    ]);

    render(<DeltaLogPage />);

    const tab = screen.getByRole("tab", { name: /Nhật ký hồ sơ/i });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);

    const detailButtons = await screen.findAllByRole("button", { name: /Xem chi tiết/i });
    fireEvent.click(detailButtons[0]);

    await waitFor(() => {
      expect(getExamById).toHaveBeenCalledWith("exam-1");
    });

    expect(await screen.findByText("Đau họng 3 ngày")).toBeInTheDocument();
    expect(screen.getByText("Đau họng")).toBeInTheDocument();
    const updatedAtLabel = format(parseISO("2026-09-16T10:15:00.000Z"), "dd/MM/yyyy HH:mm", {
      locale: viLocale,
    });
    expect(
      screen.getByText(`Cập nhật bởi Bác sĩ Lê Thị Hồng Xoan lúc ${updatedAtLabel}`),
    ).toBeInTheDocument();
  });
});
