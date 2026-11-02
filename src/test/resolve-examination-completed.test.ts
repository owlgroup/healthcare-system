import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: async (value: string) => value,
  decrypt: async (value: string) => value,
}));

vi.mock("@/lib/stt-nlp-api", () => ({
  analyzeTranscript: vi.fn(),
  suggestIcd10: vi.fn(),
}));

import { resolveExaminationId } from "@/lib/emr-api";

function examRow() {
  return {
    id: "exam-locked",
    appointment_id: "appt-completed",
    patient_id: "user-1",
    doctor_id: "doc-1",
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "Viêm họng",
    p_text: "Nghỉ ngơi",
    status: "LOCKED",
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    icd_codes: [],
  };
}

describe("resolveExaminationId for completed appointments", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("should load an existing SOAP without create_or_get_examination", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "get_examination_for_doctor") {
        return Promise.resolve({ data: [examRow()], error: null });
      }
      return Promise.resolve({ data: null, error: { message: "INVALID_APPOINTMENT_STATUS" } });
    });

    const examId = await resolveExaminationId("appt-completed");

    expect(examId).toBe("exam-locked");
    expect(rpc).not.toHaveBeenCalledWith(
      "create_or_get_examination",
      expect.anything(),
    );
  });

  it("should create an exam only when none exists yet", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "get_examination_for_doctor") {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === "create_or_get_examination") {
        return Promise.resolve({ data: "exam-new", error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    });

    const examId = await resolveExaminationId("appt-in-progress");

    expect(examId).toBe("exam-new");
    expect(rpc).toHaveBeenCalledWith("create_or_get_examination", {
      p_appointment_id: "appt-in-progress",
    });
  });
});
