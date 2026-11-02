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

import { getExaminationVersionHistory } from "@/lib/emr-api";

describe("getExaminationVersionHistory", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("maps RPC rows and decrypts soap_snapshot", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "log-2",
          version: 2,
          action: "UPDATED",
          actor_name: "Lê Thị Hồng Xoan",
          created_at: "2026-09-16T14:15:00.000Z",
          changed_fields: ["s_text", "a_text"],
          soap_snapshot: {
            s_text: "Sốt cao",
            o_text: "Ổn",
            a_text: "Sốt chưa rõ nguyên nhân",
            p_text: "Theo dõi",
          },
          is_current: true,
        },
        {
          id: "log-1",
          version: 1,
          action: "AI_GENERATED",
          actor_name: null,
          created_at: "2026-09-16T13:00:00.000Z",
          changed_fields: [],
          soap_snapshot: {
            s_text: "Nhiệt độ cao",
            o_text: "Ổn",
            a_text: "Tình trạng sốt",
            p_text: "Theo dõi",
          },
          is_current: false,
        },
      ],
      error: null,
    });

    const versions = await getExaminationVersionHistory("exam-1");

    expect(rpc).toHaveBeenCalledWith("get_examination_version_history", {
      p_exam_id: "exam-1",
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      id: "log-2",
      version: 2,
      action: "UPDATED",
      is_current: true,
      changed_fields: ["s_text", "a_text"],
      soap_snapshot: {
        s_text: "Sốt cao",
        a_text: "Sốt chưa rõ nguyên nhân",
      },
    });
    expect(versions[1].soap_snapshot?.s_text).toBe("Nhiệt độ cao");
  });

  it("throws a mapped error when RPC fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "UNAUTHORIZED" },
    });

    await expect(getExaminationVersionHistory("exam-1")).rejects.toThrow();
  });
});
