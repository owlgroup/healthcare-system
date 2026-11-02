import { describe, expect, it } from "vitest";
import { PatientDobError } from "@/lib/patient-dob-api";
import { isValidIsoDate, normalizeDobValue } from "@/lib/patient-dob-validation";
import {
  DOB_RETURN_KEY,
  resolvePostLoginPath,
  VERIFY_DOB_PATH,
} from "@/lib/portal-auth";

describe("normalizeDobValue", () => {
  it("extracts YYYY-MM-DD from postgres-style values", () => {
    expect(normalizeDobValue("1999-11-23")).toBe("1999-11-23");
    expect(normalizeDobValue("1999-11-23T00:00:00.000Z")).toBe("1999-11-23");
  });
});

describe("isValidIsoDate", () => {
  it("accepts valid ISO dates", () => {
    expect(isValidIsoDate("1990-05-15")).toBe(true);
    expect(isValidIsoDate("2000-01-01")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("15-05-1990")).toBe(false);
    expect(isValidIsoDate("1990-13-01")).toBe(false);
    expect(isValidIsoDate("1990-02-30")).toBe(false);
  });
});

describe("resolvePostLoginPath", () => {
  it("patient goes to home after successful login", () => {
    expect(resolvePostLoginPath("patient")).toBe("/home");
    expect(resolvePostLoginPath("patient", { pathname: "/account" })).toBe("/account");
  });
});

describe("PatientDobError", () => {
  it("parses API error fields", () => {
    const err = new PatientDobError(401, {
      error: "DOB_MISMATCH",
      message: "Ngày sinh không khớp",
      attemptsLeft: 2,
    });
    expect(err.code).toBe("DOB_MISMATCH");
    expect(err.message).toBe("Ngày sinh không khớp");
    expect(err.attemptsLeft).toBe(2);
  });
});

describe("verify-dob fallback route", () => {
  it("still exists for session re-verification", () => {
    expect(VERIFY_DOB_PATH).toBe("/verify-dob");
    expect(DOB_RETURN_KEY).toBe("dob_return_to");
  });
});
