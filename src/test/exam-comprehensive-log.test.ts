import { describe, expect, it } from "vitest";
import {
  buildComprehensiveExamTimeline,
  formatExamActivityMessage,
  type ExamActivityLogEntry,
  type SoapNoteSnapshot,
} from "@/lib/exam-activity-log";

const aiSoap: SoapNoteSnapshot = {
  s_text: "AI đau họng",
  o_text: "AI họng đỏ",
  a_text: "AI viêm họng",
  p_text: "AI nghỉ ngơi",
};

const doctorSoap: SoapNoteSnapshot = {
  s_text: "Đau họng 3 ngày",
  o_text: "Họng đỏ",
  a_text: "Viêm họng cấp",
  p_text: "Nghỉ ngơi, uống nhiều nước",
};

const addendumSoap: SoapNoteSnapshot = {
  s_text: "Bổ sung: sốt tái phát tối",
  o_text: null,
  a_text: null,
  p_text: null,
};

function log(overrides: Partial<ExamActivityLogEntry> & Pick<ExamActivityLogEntry, "id" | "action" | "created_at">): ExamActivityLogEntry {
  return {
    exam_id: "exam-1",
    actor_id: "doc-1",
    actor_name: "Nguyễn Văn A",
    message: formatExamActivityMessage(overrides.action, "Nguyễn Văn A"),
    changed_fields: [],
    related_exam_id: null,
    ...overrides,
  };
}

describe("formatExamActivityMessage (TC-DLS-022)", () => {
  it("should describe AI draft, edit, sign, and addendum", () => {
    expect(formatExamActivityMessage("AI_GENERATED", "Nguyễn Văn A")).toBe(
      "Bác sĩ Nguyễn Văn A đã tạo nháp SOAP bằng AI"
    );
    expect(formatExamActivityMessage("UPDATED", "Nguyễn Văn A")).toBe(
      "Bác sĩ Nguyễn Văn A đã cập nhật nội dung hồ sơ"
    );
    expect(formatExamActivityMessage("SIGNED", "Nguyễn Văn A")).toBe(
      "Bác sĩ Nguyễn Văn A đã ký xác nhận hồ sơ"
    );
    expect(formatExamActivityMessage("ADDENDUM_CREATED", "Nguyễn Văn A")).toBe(
      "Bác sĩ Nguyễn Văn A đã tạo phiếu bổ sung"
    );
  });
});

describe("buildComprehensiveExamTimeline (TC-DLS-022)", () => {
  it("should order AI draft, doctor edit, sign-off, then addendum", () => {
    const events = buildComprehensiveExamTimeline({
      examId: "exam-1",
      actorName: "Nguyễn Văn A",
      examCreatedAt: "2026-09-16T09:00:00.000Z",
      logs: [
        log({ id: "u1", action: "UPDATED", created_at: "2026-09-16T10:10:00.000Z", changed_fields: ["s_text"] }),
        log({ id: "ai", action: "AI_GENERATED", created_at: "2026-09-16T10:00:00.000Z" }),
        log({ id: "s1", action: "SIGNED", created_at: "2026-09-16T10:20:00.000Z" }),
        log({
          id: "a1",
          action: "ADDENDUM_CREATED",
          created_at: "2026-09-16T10:30:00.000Z",
          related_exam_id: "add-1",
        }),
      ],
      aiBaseline: aiSoap,
      doctorSoap,
      examStatus: "LOCKED",
      signedAt: "2026-09-16T10:20:00.000Z",
      addenda: [{
        id: "add-1",
        created_at: "2026-09-16T10:30:00.000Z",
        soap: addendumSoap,
        actor_name: "Nguyễn Văn A",
        amendment_reason: "Sai sót ghi nhận triệu chứng",
      }],
    });

    expect(events.map((e) => e.action)).toEqual([
      "AI_GENERATED",
      "UPDATED",
      "SIGNED",
      "ADDENDUM_CREATED",
    ]);
    expect(events[0].soap).toEqual(aiSoap);
    expect(events[1].soap).toEqual(doctorSoap);
    expect(events[1].aiSoap).toEqual(aiSoap);
    expect(events[1].changed_fields).toEqual(["s_text"]);
    expect(events[2].soap).toEqual(doctorSoap);
    expect(events[3].soap).toEqual(addendumSoap);
    expect(events[3].amendment_reason).toBe("Sai sót ghi nhận triệu chứng");
  });

  it("should synthesize AI, sign, and addendum when log rows are missing", () => {
    const events = buildComprehensiveExamTimeline({
      examId: "exam-1",
      actorName: "Nguyễn Văn A",
      examCreatedAt: "2026-09-16T09:00:00.000Z",
      logs: [],
      aiBaseline: aiSoap,
      doctorSoap,
      examStatus: "LOCKED",
      signedAt: "2026-09-16T10:20:00.000Z",
      addenda: [{
        id: "add-1",
        created_at: "2026-09-16T10:30:00.000Z",
        soap: addendumSoap,
        actor_name: "Nguyễn Văn A",
        amendment_reason: "Thiếu sốt",
      }],
    });

    expect(events.map((e) => e.action)).toEqual([
      "AI_GENERATED",
      "SIGNED",
      "ADDENDUM_CREATED",
    ]);
    expect(events[0].soap?.s_text).toBe("AI đau họng");
    expect(events[1].soap?.s_text).toBe("Đau họng 3 ngày");
    expect(events[2].soap?.s_text).toBe("Bổ sung: sốt tái phát tối");
    expect(events[2].amendment_reason).toBe("Thiếu sốt");
    expect(events[0].created_at).toBe("2026-09-16T09:00:00.000Z");
    expect(events[1].created_at).toBe("2026-09-16T10:20:00.000Z");
  });
});
