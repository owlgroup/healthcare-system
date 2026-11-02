import { describe, expect, it } from "vitest";
import { mapPatientRecordDeleteError } from "@/lib/patient-records";

describe("mapPatientRecordDeleteError", () => {
  it("should map appointments FK constraint to Vietnamese copy", () => {
    const message =
      'update or delete on table "patient" violates foreign key constraint "appointments_profile_id_fkey" on table "appointments"';

    expect(mapPatientRecordDeleteError(message)).toBe(
      "Không thể xóa hồ sơ vì bệnh nhân còn lịch hẹn. Vui lòng hủy hoặc xóa các lịch hẹn trước.",
    );
  });

  it("should map generic foreign key violations to Vietnamese copy", () => {
    expect(
      mapPatientRecordDeleteError(
        'update or delete on table "patient" violates foreign key constraint "queue_entries_profile_id_fkey" on table "queue_entries"',
      ),
    ).toBe("Không thể xóa hồ sơ vì dữ liệu này đang được sử dụng ở nơi khác.");

    expect(mapPatientRecordDeleteError("23503")).toBe(
      "Không thể xóa hồ sơ vì dữ liệu này đang được sử dụng ở nơi khác.",
    );
  });

  it("should leave unrelated messages unchanged", () => {
    expect(mapPatientRecordDeleteError("JWT expired")).toBe("JWT expired");
  });
});
