import { describe, expect, it } from "vitest";
import {
  activityLogsToVersionHistory,
  diffSoapFormFields,
  formatExamUpdateActivityMessage,
} from "@/lib/exam-activity-log";

describe("formatExamUpdateActivityMessage (TC-DLS-403)", () => {
  it("should name the doctor and the update action", () => {
    expect(formatExamUpdateActivityMessage("Nguyễn Văn A")).toBe(
      "Bác sĩ Nguyễn Văn A đã cập nhật nội dung hồ sơ"
    );
  });

  it("should still form a readable line when the doctor name is missing", () => {
    expect(formatExamUpdateActivityMessage("  ")).toBe(
      "Bác sĩ đã cập nhật nội dung hồ sơ"
    );
  });
});

describe("diffSoapFormFields", () => {
  it("should list only SOAP sections whose text changed", () => {
    expect(
      diffSoapFormFields(
        { s_text: "Đau họng", o_text: "Họng đỏ", a_text: "Viêm họng", p_text: "Nghỉ ngơi" },
        { s_text: "Đau họng 3 ngày", o_text: "Họng đỏ", a_text: "Viêm họng cấp", p_text: "Nghỉ ngơi" },
      )
    ).toEqual(["s_text", "a_text"]);
  });
});

describe("activityLogsToVersionHistory", () => {
  it("numbers versions ascending and returns newest first", () => {
    const versions = activityLogsToVersionHistory([
      {
        id: "a",
        action: "AI_GENERATED",
        actor_name: null,
        created_at: "2026-09-16T10:00:00.000Z",
        changed_fields: [],
      },
      {
        id: "b",
        action: "UPDATED",
        actor_name: "Nguyễn Văn A",
        created_at: "2026-09-16T11:00:00.000Z",
        changed_fields: ["s_text"],
      },
      {
        id: "c",
        action: "SIGNED",
        actor_name: "Nguyễn Văn A",
        created_at: "2026-09-16T12:00:00.000Z",
        changed_fields: [],
      },
    ]);

    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(versions[0]).toMatchObject({ id: "c", is_current: true, soap_snapshot: null });
    expect(versions[2]).toMatchObject({ id: "a", is_current: false });
  });
});
