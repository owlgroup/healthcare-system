import { describe, expect, it } from "vitest";
import {
  compareCccdBhytIdentity,
  joinCccdFullName,
  NAME_MISMATCH_THRESHOLD,
  nameMismatchRatio,
  normalizeVnName,
} from "@/lib/cccd-bhyt-cross-validate";

describe("joinCccdFullName", () => {
  it("should join family name then given name", () => {
    expect(joinCccdFullName("NGUYỄN", "TẤN PHÁT")).toBe("NGUYỄN TẤN PHÁT");
  });
});

describe("normalizeVnName", () => {
  it("should strip diacritics, uppercase, and collapse spaces", () => {
    expect(normalizeVnName("  Nguyễn   Tấn  Phát  ")).toBe("NGUYEN TAN PHAT");
    expect(normalizeVnName("trịnh xuân đoàn")).toBe("TRINH XUAN DOAN");
  });

  it("should return empty for whitespace-only input", () => {
    expect(normalizeVnName("   ")).toBe("");
    expect(normalizeVnName("")).toBe("");
  });
});

describe("nameMismatchRatio", () => {
  it("should return 0 for identical names after normalize", () => {
    expect(nameMismatchRatio("NGUYỄN TẤN PHÁT", "nguyen tan phat")).toBe(0);
  });

  it("should treat token-order differences as a match", () => {
    expect(nameMismatchRatio("NGUYỄN TẤN PHÁT", "TẤN PHÁT NGUYỄN")).toBe(0);
  });

  it("should stay at or below 20% for small OCR noise", () => {
    const ratio = nameMismatchRatio("NGUYEN TAN PHAT", "NGUYEN TAN PHATT");
    expect(ratio).toBeLessThanOrEqual(NAME_MISMATCH_THRESHOLD);
  });

  it("should exceed 20% for completely different names", () => {
    const ratio = nameMismatchRatio("NGUYỄN TẤN PHÁT", "TRỊNH XUÂN ĐOÀN");
    expect(ratio).toBeGreaterThan(NAME_MISMATCH_THRESHOLD);
  });
});

describe("compareCccdBhytIdentity", () => {
  it("should match when name and DOB are the same", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "Nguyễn Tấn Phát",
      bhytDob: "1990-01-15",
    });
    expect(result.hasMismatch).toBe(false);
    expect(result.nameMismatch).toBe(false);
    expect(result.dobMismatch).toBe(false);
  });

  it("should match DOB when one side is dd/mm/yyyy", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "15/01/1990",
      bhytName: "NGUYỄN TẤN PHÁT",
      bhytDob: "1990-01-15",
    });
    expect(result.dobMismatch).toBe(false);
    expect(result.hasMismatch).toBe(false);
  });

  it("should detect the example name mismatch and not silently pass", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "TRỊNH XUÂN ĐOÀN",
      bhytDob: "1990-01-15",
    });
    expect(result.hasMismatch).toBe(true);
    expect(result.nameMismatch).toBe(true);
    expect(result.dobMismatch).toBe(false);
    expect(result.nameMismatchRatio).toBeGreaterThan(NAME_MISMATCH_THRESHOLD);
  });

  it("should treat an off-by-one DOB as a mismatch even when names match", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "NGUYỄN TẤN PHÁT",
      bhytDob: "1990-01-16",
    });
    expect(result.hasMismatch).toBe(true);
    expect(result.dobMismatch).toBe(true);
    expect(result.nameMismatch).toBe(false);
  });

  it("should skip the whole check when BHYT name and DOB are both empty", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "",
      bhytDob: "  ",
    });
    expect(result.hasMismatch).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it("should skip name comparison when either name is empty", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "",
      bhytDob: "1990-01-15",
    });
    expect(result.nameMismatch).toBe(false);
    expect(result.hasMismatch).toBe(false);
  });

  it("should skip DOB comparison when either DOB is empty", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "NGUYỄN TẤN PHÁT",
      bhytDob: "",
    });
    expect(result.dobMismatch).toBe(false);
    expect(result.hasMismatch).toBe(false);
  });

  it("should flag both fields when name and DOB both differ", () => {
    const result = compareCccdBhytIdentity({
      cccdName: "NGUYỄN TẤN PHÁT",
      cccdDob: "1990-01-15",
      bhytName: "TRỊNH XUÂN ĐOÀN",
      bhytDob: "1991-02-02",
    });
    expect(result.hasMismatch).toBe(true);
    expect(result.nameMismatch).toBe(true);
    expect(result.dobMismatch).toBe(true);
  });
});
