import { describe, expect, it } from "vitest";
import {
  resolveAiAccuracyDateRange,
  sectionEditPct,
  SOAP_SECTION_LABELS,
  toDoctorChartRows,
  toSoapChartRows,
  type AiAccuracyDoctorRow,
  type AiAccuracySoapRow,
} from "@/lib/ai-accuracy-stats";

describe("sectionEditPct", () => {
  it("should return 0 when AI baseline is empty", () => {
    expect(sectionEditPct("", "doctor added text")).toBe(0);
    expect(sectionEditPct(null, "text")).toBe(0);
  });

  it("should return 0 when doctor keeps the same length", () => {
    expect(sectionEditPct("hello", "world")).toBe(0);
  });

  it("should match the length-delta formula used at sign-off", () => {
    // abs(10 - 5) / 5 * 100 = 100
    expect(sectionEditPct("abcde", "abcdefghij")).toBe(100);
    // abs(6 - 10) / 10 * 100 = 40
    expect(sectionEditPct("0123456789", "012345")).toBe(40);
  });

  it("should cap edit percent at 100", () => {
    expect(sectionEditPct("ab", "abcdefghij")).toBe(100);
  });
});

describe("toSoapChartRows", () => {
  it("should always return four SOAP rows in S/O/A/P order", () => {
    const rows = toSoapChartRows([]);
    expect(rows.map((r) => r.section)).toEqual(["S", "O", "A", "P"]);
    expect(rows.map((r) => r.label)).toEqual([
      SOAP_SECTION_LABELS.S,
      SOAP_SECTION_LABELS.O,
      SOAP_SECTION_LABELS.A,
      SOAP_SECTION_LABELS.P,
    ]);
    expect(rows.every((r) => r.retentionPct === 0 && r.editPct === 0 && r.editedCount === 0)).toBe(true);
  });

  it("should map retention and edit percent for a single edited section", () => {
    const input: AiAccuracySoapRow[] = [
      { section: "S", avg_retention_pct: 80, avg_edit_pct: 20, edited_count: 3 },
    ];
    const rows = toSoapChartRows(input);
    expect(rows[0]).toMatchObject({
      section: "S",
      retentionPct: 80,
      editPct: 20,
      editedCount: 3,
    });
    expect(rows[1]).toMatchObject({ section: "O", retentionPct: 0, editPct: 0, editedCount: 0 });
  });

  it("should map all-unedited SOAP stats as 100% retention", () => {
    const input: AiAccuracySoapRow[] = [
      { section: "S", avg_retention_pct: 100, avg_edit_pct: 0, edited_count: 0 },
      { section: "O", avg_retention_pct: 100, avg_edit_pct: 0, edited_count: 0 },
      { section: "A", avg_retention_pct: 100, avg_edit_pct: 0, edited_count: 0 },
      { section: "P", avg_retention_pct: 100, avg_edit_pct: 0, edited_count: 0 },
    ];
    const rows = toSoapChartRows(input);
    expect(rows.every((r) => r.retentionPct === 100 && r.editPct === 0)).toBe(true);
  });
});

describe("toDoctorChartRows", () => {
  it("should return an empty list when there are no doctors", () => {
    expect(toDoctorChartRows([])).toEqual([]);
  });

  it("should sort doctors by exam count descending and prefix names", () => {
    const input: AiAccuracyDoctorRow[] = [
      {
        doctor_id: "d2",
        doctor_name: "Nguyễn B",
        total: 2,
        edited_count: 1,
        avg_retention_pct: 50,
        edit_rate_pct: 50,
      },
      {
        doctor_id: "d1",
        doctor_name: "Lê A",
        total: 10,
        edited_count: 2,
        avg_retention_pct: 90,
        edit_rate_pct: 20,
      },
    ];
    const rows = toDoctorChartRows(input);
    expect(rows.map((r) => r.doctorId)).toEqual(["d1", "d2"]);
    expect(rows[0].doctorName).toBe("BS. Lê A");
    expect(rows[0].total).toBe(10);
    expect(rows[0].retentionPct).toBe(90);
  });

  it("should keep an existing BS prefix on doctor names", () => {
    const rows = toDoctorChartRows([
      {
        doctor_id: "d1",
        doctor_name: "BS. Trần C",
        total: 1,
        edited_count: 0,
        avg_retention_pct: 100,
        edit_rate_pct: 0,
      },
    ]);
    expect(rows[0].doctorName).toBe("BS. Trần C");
  });
});

describe("resolveAiAccuracyDateRange", () => {
  const now = new Date("2026-08-15T12:00:00");

  it("should return null bounds for all-time preset", () => {
    expect(resolveAiAccuracyDateRange("all", "2026-01-01", "2026-01-31", now)).toEqual({
      dateFrom: null,
      dateTo: null,
    });
  });

  it("should use inclusive 7-day and 30-day windows ending today", () => {
    expect(resolveAiAccuracyDateRange("today", null, null, now)).toEqual({
      dateFrom: "2026-08-15",
      dateTo: "2026-08-15",
    });
    expect(resolveAiAccuracyDateRange("7d", null, null, now)).toEqual({
      dateFrom: "2026-08-09",
      dateTo: "2026-08-15",
    });
    expect(resolveAiAccuracyDateRange("30d", null, null, now)).toEqual({
      dateFrom: "2026-07-17",
      dateTo: "2026-08-15",
    });
  });

  it("should pass through custom dates", () => {
    expect(resolveAiAccuracyDateRange("custom", "2026-07-01", "2026-07-31", now)).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
  });
});
