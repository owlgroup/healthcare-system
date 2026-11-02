import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MENU_GROUPS,
  ACCOUNT_MENU_ITEMS,
  findAccountMenuItem,
} from "@/config/account-menu";
import {
  bloodPressureStatus,
  bmiStatus,
  computeBmi,
} from "@/types/patient-account";

describe("account-menu config", () => {
  it("has 7 sub-menu items in 3 groups", () => {
    expect(ACCOUNT_MENU_GROUPS).toHaveLength(3);
    expect(ACCOUNT_MENU_ITEMS).toHaveLength(7);
  });

  it("findAccountMenuItem resolves nested account paths", () => {
    expect(findAccountMenuItem("/account/personal")?.id).toBe("personal");
    expect(findAccountMenuItem("/account/settings")?.id).toBe("settings");
    expect(findAccountMenuItem("/home")).toBeUndefined();
  });

  it("includes expected Vietnamese labels", () => {
    const labels = ACCOUNT_MENU_ITEMS.map((i) => i.label);
    expect(labels).toContain("Thông tin cá nhân");
    expect(labels).toContain("Cài đặt chung");
    expect(labels).toContain("Chỉ số sinh tồn");
  });
});

describe("patient vitals helpers", () => {
  it("computes BMI", () => {
    expect(computeBmi(68.5, 175)).toBe(22.4);
    expect(computeBmi(null, 175)).toBeNull();
  });

  it("classifies BMI status", () => {
    expect(bmiStatus(22.4)).toBe("Bình thường");
    expect(bmiStatus(31)).toBe("Béo phì");
  });

  it("classifies blood pressure", () => {
    expect(bloodPressureStatus(120, 80)).toBe("Bình thường");
    expect(bloodPressureStatus(145, 95)).toBe("Cao");
  });
});
