import { describe, expect, it } from "vitest";
import {
  CCCD_REQUIRED_EMPTY,
  CCCD_REQUIRED_KEYS,
  validateCccdRequired,
} from "@/lib/cccd-required";

const filled = {
  idNumber: "012345678901",
  expirationDate: "2030-01-01",
  residentialAddress: "Hà Nội",
  issuedDate: "2020-01-01",
  issuer: "Cục cảnh sát QLHC về TTXH",
};

describe("validateCccdRequired", () => {
  it("should return no errors when all five CCCD fields are filled", () => {
    expect(validateCccdRequired(filled)).toEqual({});
  });

  it("should return Vui lòng nhập for every empty CCCD field", () => {
    const result = validateCccdRequired({
      idNumber: "",
      expirationDate: "",
      residentialAddress: "",
      issuedDate: "",
      issuer: "",
    });

    expect(CCCD_REQUIRED_KEYS).toEqual([
      "idNumber",
      "expirationDate",
      "residentialAddress",
      "issuedDate",
      "issuer",
    ]);
    for (const key of CCCD_REQUIRED_KEYS) {
      expect(result[key]).toBe(CCCD_REQUIRED_EMPTY);
    }
  });

  it("should treat whitespace-only values as empty", () => {
    const result = validateCccdRequired({
      ...filled,
      idNumber: "   ",
      issuer: "\t",
    });

    expect(result.idNumber).toBe(CCCD_REQUIRED_EMPTY);
    expect(result.issuer).toBe(CCCD_REQUIRED_EMPTY);
    expect(result.expirationDate).toBeUndefined();
  });
});
