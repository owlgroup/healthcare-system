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

import { createExamAddendum } from "@/lib/emr-api";

describe("createExamAddendum unique appointment constraint", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("should map the appointment unique violation to a Vietnamese addendum error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "medical_examinations_appointment_id_key"',
      },
    });

    await expect(
      createExamAddendum("exam-1", { s_text: "Bổ sung", reason: "Sai sót" }),
    ).rejects.toThrow("Không tạo được phiếu bổ sung cho lịch hẹn này.");
  });
});
