import { describe, expect, it } from "vitest";
import {
  appointmentListTone,
  joinMeta,
  sexLabel,
} from "@/lib/patient-list-presentation";

describe("appointmentListTone", () => {
  it("should use the portal palette for each appointment status", () => {
    expect(appointmentListTone("CONFIRMED")).toEqual({
      label: "Chờ khám",
      className: "bg-[#EAF0FF] text-[#1D4FD8]",
    });
    expect(appointmentListTone("COMPLETED").label).toBe("Hoàn thành");
    expect(appointmentListTone("CANCELLED").className).toContain("text-[#C41740]");
    expect(appointmentListTone(null).label).toBe("Chưa có lịch");
  });
});

describe("sexLabel", () => {
  it("should read BHYT gender and pronouns as Nam or Nữ", () => {
    expect(sexLabel("Nữ", null)).toBe("Nữ");
    expect(sexLabel(null, "Nam")).toBe("Nam");
    expect(sexLabel("Female", null)).toBe("Nữ");
    expect(sexLabel(null, null)).toBeNull();
  });
});

describe("joinMeta", () => {
  it("should skip empty parts", () => {
    expect(joinMeta(["Nữ", null, "37 tuổi", "21/03/1989"])).toBe("Nữ · 37 tuổi · 21/03/1989");
  });
});
