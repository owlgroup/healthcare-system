import { describe, expect, it } from "vitest";
import { examsToHealthRecordVersions } from "@/lib/patient-health-records-storage";
import type { MedicalExamination } from "@/types/emr";

function exam(overrides: Partial<MedicalExamination>): MedicalExamination {
  return {
    id: "exam-a",
    appointment_id: "appt-a",
    patient_id: "user-1",
    doctor_id: "doc-1",
    s_text: "S",
    o_text: "O",
    a_text: "A",
    p_text: "P",
    status: "LOCKED",
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    icd_codes: [],
    ...overrides,
  };
}

describe("examsToHealthRecordVersions", () => {
  it("should number locked exams in sign order and list newest first", () => {
    const versions = examsToHealthRecordVersions([
      exam({
        id: "exam-new",
        appointment_id: "appt-2",
        updated_at: "2026-09-15T20:27:00.000Z",
        icd_codes: [
          {
            id: "i1",
            exam_id: "exam-new",
            icd_code: "J06.9",
            icd_name: "URI",
            is_ai_suggested: false,
            ai_confidence: null,
            ai_reason: null,
            confirm_status: "CONFIRMED",
            confirmed_at: null,
            display_order: 0,
            created_at: "2026-09-15T20:27:00.000Z",
          },
        ],
      }),
      exam({
        id: "exam-old",
        appointment_id: "appt-1",
        updated_at: "2026-08-01T10:00:00.000Z",
      }),
    ]);

    expect(versions).toHaveLength(2);
    expect(versions[0].exam_id).toBe("exam-new");
    expect(versions[0].version).toBe(2);
    expect(versions[1].exam_id).toBe("exam-old");
    expect(versions[1].version).toBe(1);
    expect(versions[0].icd_codes).toHaveLength(1);
  });

  it("should ignore drafts and duplicate exam ids", () => {
    const versions = examsToHealthRecordVersions([
      exam({ id: "exam-a", status: "DRAFT" }),
      exam({ id: "exam-b", appointment_id: "appt-b", updated_at: "2026-02-01T00:00:00.000Z" }),
      exam({ id: "exam-b", appointment_id: "appt-b", updated_at: "2026-02-01T00:00:00.000Z" }),
    ]);

    expect(versions.map((v) => v.exam_id)).toEqual(["exam-b"]);
    expect(versions[0].version).toBe(1);
  });
});
