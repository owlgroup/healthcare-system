import { describe, expect, it } from "vitest";
import { validatePasswordRules } from "@/lib/password-validation";

describe("validatePasswordRules", () => {
  it("accepts password with 8+ chars, uppercase, and digit", () => {
    expect(validatePasswordRules("Secret1x").valid).toBe(true);
  });

  it("rejects short password", () => {
    const r = validatePasswordRules("Sec1");
    expect(r.valid).toBe(false);
    expect(r.minLength).toBe(false);
  });

  it("rejects without uppercase", () => {
    const r = validatePasswordRules("secret12");
    expect(r.valid).toBe(false);
    expect(r.hasUppercase).toBe(false);
  });

  it("rejects without digit", () => {
    const r = validatePasswordRules("Secretab");
    expect(r.valid).toBe(false);
    expect(r.hasDigit).toBe(false);
  });
});
