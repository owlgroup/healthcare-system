import { describe, expect, it } from "vitest";
import {
  mapPatientPortalRow,
  mapPatientRecordListRow,
} from "@/types/patient-portal";

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  submitted_at: "2026-08-15T00:00:00Z",
  updated_at: "2026-08-15T00:00:00Z",
};

describe("mapPatientRecordListRow name order", () => {
  it("should join last name then first name (Họ + Tên)", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "Mứt",
      legal_last_name: "Trần Thị",
      status: "ACTIVE",
    });
    expect(row.full_name).toBe("Trần Thị Mứt");
  });

  it("should fall back to BN {id} when names are empty", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: null,
      legal_last_name: null,
      id_number: "079123456789",
      status: "ACTIVE",
    });
    expect(row.full_name).toBe("BN 079123456789");
  });

  it("should fall back to email then Bệnh nhân", () => {
    expect(
      mapPatientRecordListRow({
        ...baseRow,
        legal_first_name: "  ",
        legal_last_name: "",
        email_address: "bn@example.com",
        status: "DRAFT",
      }).full_name,
    ).toBe("bn@example.com");

    expect(
      mapPatientRecordListRow({
        ...baseRow,
        legal_first_name: null,
        legal_last_name: null,
        status: "DRAFT",
      }).full_name,
    ).toBe("Bệnh nhân");
  });
});

describe("mapPatientRecordListRow status from DB", () => {
  it("should show Đang hoạt động for staff ACTIVE even when submitted_at is set", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "Hậu",
      legal_last_name: "Phạm",
      created_by_role: "admin",
      status: "ACTIVE",
    });
    expect(row.status).toBe("Đang hoạt động");
  });

  it("should show Đã nộp for patient UNVERIFIED self-registration", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "An",
      legal_last_name: "Nguyễn",
      created_by_role: "patient",
      status: "UNVERIFIED",
    });
    expect(row.status).toBe("Đã nộp");
  });

  it("should not treat submitted_at as Đã nộp when status is DRAFT", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "Bình",
      legal_last_name: "Lê",
      created_by_role: "admin",
      status: "DRAFT",
    });
    expect(row.status).toBe("Bản nháp");
    expect(row.status).not.toBe("Đã nộp");
  });

  it("should show Ngừng hoạt động for INACTIVE", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "Lan",
      legal_last_name: "Võ",
      status: "INACTIVE",
    });
    expect(row.status).toBe("Ngừng hoạt động");
  });

  it("should show Đã từ chối for REJECTED", () => {
    const row = mapPatientRecordListRow({
      ...baseRow,
      legal_first_name: "Minh",
      legal_last_name: "Đỗ",
      created_by_role: "patient",
      status: "REJECTED",
    });
    expect(row.status).toBe("Đã từ chối");
  });
});

describe("mapPatientPortalRow", () => {
  it("should use Họ + Tên and keep DB status", () => {
    const row = mapPatientPortalRow({
      ...baseRow,
      legal_first_name: "Đức Hậu",
      legal_last_name: "Phạm",
      consent_accepted: true,
      status: "ACTIVE",
    });
    expect(row.full_name).toBe("Phạm Đức Hậu");
    expect(row.status).toBe("ACTIVE");
  });

  it("should keep REJECTED as DB status", () => {
    const row = mapPatientPortalRow({
      ...baseRow,
      legal_first_name: "An",
      legal_last_name: "Nguyễn",
      consent_accepted: true,
      status: "REJECTED",
    });
    expect(row.status).toBe("REJECTED");
  });
});
