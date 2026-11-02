import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createExamAddendum = vi.fn();
const listExamAddenda = vi.fn();

vi.mock("@/lib/emr-api", () => ({
  createExamAddendum: (...args: unknown[]) => createExamAddendum(...args),
  listExamAddenda: (...args: unknown[]) => listExamAddenda(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import ExamAddendumForm from "@/components/emr/ExamAddendumForm";

describe("Exam addendum confirmation reason (TC-DLS-015)", () => {
  beforeEach(() => {
    createExamAddendum.mockReset();
    listExamAddenda.mockReset();
    createExamAddendum.mockResolvedValue("add-1");
    listExamAddenda.mockResolvedValue([]);
  });

  it("should not save when confirmation reason is empty", async () => {
    render(<ExamAddendumForm examId="exam-1" />);

    await waitFor(() => {
      expect(listExamAddenda).toHaveBeenCalledWith("exam-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /Tạo phiếu bổ sung/i }));
    fireEvent.change(screen.getByPlaceholderText("Nội dung bổ sung / hiệu chỉnh..."), {
      target: { value: "Bổ sung sốt tái phát" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lưu phiếu bổ sung/i }));

    expect(createExamAddendum).not.toHaveBeenCalled();
  });

  it("should create an addendum when reason and content are provided", async () => {
    const onCreated = vi.fn();
    render(<ExamAddendumForm examId="exam-1" onCreated={onCreated} />);

    await waitFor(() => {
      expect(listExamAddenda).toHaveBeenCalledWith("exam-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /Tạo phiếu bổ sung/i }));
    fireEvent.change(screen.getByPlaceholderText("Lý do xác nhận / hiệu chỉnh..."), {
      target: { value: "Sai sót ghi nhận triệu chứng" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nội dung bổ sung / hiệu chỉnh..."), {
      target: { value: "Bổ sung sốt tái phát tối" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lưu phiếu bổ sung/i }));

    await waitFor(() => {
      expect(createExamAddendum).toHaveBeenCalledWith("exam-1", {
        s_text: "Bổ sung sốt tái phát tối",
        reason: "Sai sót ghi nhận triệu chứng",
      });
    });
    expect(onCreated).toHaveBeenCalled();
  });

  it("should list saved addenda on the signed exam", async () => {
    listExamAddenda.mockResolvedValue([
      {
        id: "add-1",
        appointment_id: "appt-1",
        patient_id: "user-1",
        doctor_id: "doc-1",
        s_text: "xyz",
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

    render(<ExamAddendumForm examId="exam-1" />);

    expect(await screen.findByText("Phiếu bổ sung đã tạo")).toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();
    expect(screen.getByText("xyz")).toBeInTheDocument();
    expect(listExamAddenda).toHaveBeenCalledWith("exam-1");
  });
});
