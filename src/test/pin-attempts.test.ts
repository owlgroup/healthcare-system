import { describe, expect, it } from "vitest";
import {
  formatPinInvalidMessage,
  PIN_MAX_ATTEMPTS,
  remainingPinAttempts,
} from "@/lib/pin-attempts";

describe("remainingPinAttempts", () => {
  it("should show 2 then 1 remaining then lock after 3 failures", () => {
    expect(PIN_MAX_ATTEMPTS).toBe(3);
    expect(remainingPinAttempts(1)).toBe(2);
    expect(remainingPinAttempts(2)).toBe(1);
    expect(remainingPinAttempts(3)).toBe(0);
    expect(remainingPinAttempts(5)).toBe(0);
  });

  it("should format remaining attempts from the recorded failure count", () => {
    expect(formatPinInvalidMessage(remainingPinAttempts(1))).toBe(
      "Mã PIN không đúng. Còn 2 lần thử."
    );
    expect(formatPinInvalidMessage(remainingPinAttempts(2))).toBe(
      "Mã PIN không đúng. Còn 1 lần thử."
    );
  });
});
