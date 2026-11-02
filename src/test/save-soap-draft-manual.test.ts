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

import { saveSoapDraft } from "@/lib/emr-api";

describe("saveSoapDraft activity log flag (TC-DLS-403)", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "exam-1", error: null });
  });

  it("should mark a doctor-pressed save as manual", async () => {
    await saveSoapDraft("exam-1", { s_text: "Đau họng" }, { manual: true });

    expect(rpc).toHaveBeenCalledWith("save_soap_draft", expect.objectContaining({
      p_exam_id: "exam-1",
      p_manual: true,
    }));
  });

  it("should send which SOAP fields changed on a manual save", async () => {
    await saveSoapDraft(
      "exam-1",
      { s_text: "Đau họng" },
      { manual: true, changedFields: ["s_text", "a_text"] },
    );

    expect(rpc).toHaveBeenCalledWith("save_soap_draft", expect.objectContaining({
      p_manual: true,
      p_changed_fields: ["s_text", "a_text"],
    }));
  });

  it("should not mark auto-save as a history event", async () => {
    await saveSoapDraft("exam-1", { s_text: "Đau họng" });

    expect(rpc).toHaveBeenCalledWith("save_soap_draft", expect.objectContaining({
      p_manual: false,
    }));
  });
});
