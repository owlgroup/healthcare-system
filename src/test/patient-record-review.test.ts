import { describe, expect, it } from "vitest";
import { mapPatientRecordReviewError } from "@/lib/patient-records";

describe("mapPatientRecordReviewError", () => {
  it("should map FORBIDDEN to Vietnamese copy", () => {
    expect(mapPatientRecordReviewError("FORBIDDEN")).toBe(
      "Bạn không có quyền phê duyệt hồ sơ.",
    );
  });

  it("should map INVALID_STATUS to Vietnamese copy", () => {
    expect(mapPatientRecordReviewError("INVALID_STATUS")).toBe(
      "Chỉ có thể duyệt hồ sơ đang ở trạng thái Đã nộp.",
    );
  });

  it("should map REASON_REQUIRED to Vietnamese copy", () => {
    expect(mapPatientRecordReviewError("REASON_REQUIRED")).toBe(
      "Vui lòng nhập lý do từ chối.",
    );
  });

  it("should map NOT_FOUND to Vietnamese copy", () => {
    expect(mapPatientRecordReviewError("NOT_FOUND")).toBe("Không tìm thấy hồ sơ.");
  });

  it("should leave unrelated messages unchanged", () => {
    expect(mapPatientRecordReviewError("JWT expired")).toBe("JWT expired");
  });
});
