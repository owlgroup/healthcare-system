import { describe, expect, it } from "vitest";
import {
  bookingBlockedMessage,
  canPatientSelfBook,
  mapBookingError,
} from "@/lib/appointment-api";

const QA_MESSAGE = "Hồ sơ của bạn đang chờ xác minh, vui lòng chờ...";

describe("canPatientSelfBook", () => {
  it("should allow booking only when the profile is ACTIVE", () => {
    expect(canPatientSelfBook("ACTIVE")).toBe(true);
  });

  it.each(["UNVERIFIED", "DRAFT", "REJECTED", "INACTIVE", null, undefined, ""])(
    "should block booking when status is %s",
    (status) => {
      expect(canPatientSelfBook(status)).toBe(false);
    },
  );
});

describe("bookingBlockedMessage", () => {
  it("should tell the patient to wait for verification", () => {
    expect(bookingBlockedMessage()).toBe(QA_MESSAGE);
  });
});

describe("mapBookingError", () => {
  it("should tell the patient the profile is pending verification", () => {
    expect(mapBookingError("PROFILE_UNVERIFIED")).toBe(QA_MESSAGE);
  });
});
