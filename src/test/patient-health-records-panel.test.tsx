import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PatientHealthRecordsPanel from "@/components/provider/PatientHealthRecordsPanel";
import { listExamAddenda, listLockedExaminationsForPatient } from "@/lib/emr-api";
import type { MedicalExamination } from "@/types/emr";

vi.mock("@/lib/emr-api", () => ({
  listLockedExaminationsForPatient: vi.fn(),
  listExamAddenda: vi.fn(),
  verifyExaminationIntegrity: vi.fn(),
}));

vi.mock("@/components/emr/ExamAddendumForm", () => ({
  default: () => <button type="button">Tạo phiếu bổ sung</button>,
}));

vi.mock("@/components/emr/ExamComprehensiveLogControl", () => ({
  default: () => <button type="button">Nhật ký toàn diện</button>,
}));

function exam(overrides: Partial<MedicalExamination> & Pick<MedicalExamination, "id" | "status" | "created_at">): MedicalExamination {
  return {
    appointment_id: "appt",
    patient_id: "patient",
    doctor_id: "doctor",
    s_text: "Đau đầu",
    o_text: null,
    a_text: null,
    p_text: null,
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    updated_at: overrides.created_at,
    icd_codes: [],
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PatientHealthRecordsPanel patientUserId="11111111-1111-4111-8111-111111111111" profileId={null} />
    </QueryClientProvider>,
  );
}

describe("PatientHealthRecordsPanel", () => {
  it("shows the design split of version list and SOAP detail", async () => {
    vi.mocked(listLockedExaminationsForPatient).mockResolvedValue([
      exam({ id: "older", status: "LOCKED", created_at: "2026-09-20T02:30:00.000Z", s_text: "Phiên cũ" }),
      exam({ id: "newer", status: "DRAFT", created_at: "2026-09-24T02:30:00.000Z", s_text: "Triệu chứng mới" }),
    ]);
    vi.mocked(listExamAddenda).mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText("Phiên bản hồ sơ")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tất cả" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Phiên bản 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Triệu chứng mới")).toBeInTheDocument();
    expect(screen.getByText("Subjective")).toBeInTheDocument();
    expect(screen.getByText("Chẩn đoán ICD-10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Bản nháp" }));
    expect(screen.queryByText("Phiên bản 1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Phiên bản 2").length).toBeGreaterThan(0);
  });
});
