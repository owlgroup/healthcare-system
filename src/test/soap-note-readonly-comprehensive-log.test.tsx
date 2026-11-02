import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MedicalExamination } from "@/types/emr";

const listAddenda = vi.fn();
const listLogs = vi.fn();

vi.mock("@/lib/emr-api", () => ({
  verifyExaminationIntegrity: vi.fn(),
  createExamAddendum: vi.fn(),
  listExamAddenda: (...args: unknown[]) => listAddenda(...args),
  listExaminationActivityLog: (...args: unknown[]) => listLogs(...args),
}));

import SoapNoteReadOnly from "@/components/emr/SoapNoteReadOnly";

function lockedExam(overrides: Partial<MedicalExamination> = {}): MedicalExamination {
  return {
    id: "exam-1",
    appointment_id: "appt-1",
    patient_id: "user-1",
    doctor_id: "doc-1",
    s_text: "Đau họng 3 ngày",
    o_text: "Họng đỏ",
    a_text: "Viêm họng cấp",
    p_text: "Nghỉ ngơi",
    status: "LOCKED",
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: "2026-09-16T09:00:00.000Z",
    updated_at: "2026-09-16T10:20:00.000Z",
    ai_baseline: {
      s_text: "AI đau họng",
      o_text: "AI họng đỏ",
      a_text: "AI viêm họng",
      p_text: "AI nghỉ ngơi",
    },
    icd_codes: [],
    ...overrides,
  };
}

describe("SOAP read-only comprehensive log (TC-DLS-022)", () => {
  beforeEach(() => {
    listAddenda.mockReset();
    listLogs.mockReset();
    listLogs.mockResolvedValue([]);
    listAddenda.mockResolvedValue([
      {
        id: "add-1",
        appointment_id: "appt-1",
        patient_id: "user-1",
        doctor_id: "doc-1",
        s_text: "Bổ sung: sốt tái phát tối",
        o_text: null,
        a_text: null,
        p_text: null,
        status: "DRAFT",
        is_addendum: true,
        parent_exam_id: "exam-1",
        amendment_reason: "abc",
        auto_saved_at: null,
        created_at: "2026-09-16T10:30:00.000Z",
        updated_at: "2026-09-16T10:30:00.000Z",
        icd_codes: [],
      },
    ]);
  });

  it("should show addendum text on the comprehensive timeline", async () => {
    render(<SoapNoteReadOnly exam={lockedExam()} />);

    fireEvent.click(screen.getByRole("button", { name: /Nhật ký toàn diện/i }));

    await waitFor(() => {
      expect(listAddenda).toHaveBeenCalledWith("exam-1");
    });

    expect(screen.getAllByText("Bổ sung: sốt tái phát tối").length).toBeGreaterThan(0);
    expect(screen.getAllByText("abc").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lý do:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("AI đau họng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nháp AI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bác sĩ sửa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đau họng 3 ngày").length).toBeGreaterThan(0);
  });
});
