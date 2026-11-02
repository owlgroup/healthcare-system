import { describe, it, expect } from "vitest";
import {
  applyBhytParsedFillEmpty,
  applyCccdParsedFillEmpty,
  coalesceOcrField,
  isOcrTargetFieldEmpty,
  mergeOcrFillEmpty,
  checkCccdOcrQuality,
  checkBhytOcrQuality,
  normalizeOcrGender,
} from "@/lib/cccd-ocr";

describe("normalizeOcrGender", () => {
  it("should map Nam and male to Nam", () => {
    expect(normalizeOcrGender("Nam")).toBe("Nam");
    expect(normalizeOcrGender("male")).toBe("Nam");
    expect(normalizeOcrGender("m")).toBe("Nam");
  });

  it("should map Nữ and female to Nữ", () => {
    expect(normalizeOcrGender("Nữ")).toBe("Nữ");
    expect(normalizeOcrGender("nu")).toBe("Nữ");
    expect(normalizeOcrGender("female")).toBe("Nữ");
  });

  it("should return empty when OCR gender is khác or other", () => {
    expect(normalizeOcrGender("khác")).toBe("");
    expect(normalizeOcrGender("khac")).toBe("");
    expect(normalizeOcrGender("other")).toBe("");
  });

  it("should return empty for unrecognized gender text", () => {
    expect(normalizeOcrGender("unknown")).toBe("");
  });
});

describe("isOcrTargetFieldEmpty", () => {
  it("treats empty and whitespace as empty", () => {
    expect(isOcrTargetFieldEmpty("")).toBe(true);
    expect(isOcrTargetFieldEmpty("   ")).toBe(true);
    expect(isOcrTargetFieldEmpty(undefined)).toBe(true);
    expect(isOcrTargetFieldEmpty(null)).toBe(true);
  });

  it("treats non-empty strings as filled", () => {
    expect(isOcrTargetFieldEmpty("LÊ THỊ THU VÂN")).toBe(false);
  });
});

describe("coalesceOcrField", () => {
  it("fills empty field from OCR", () => {
    expect(coalesceOcrField("", "THU VÂN")).toBe("THU VÂN");
  });

  it("keeps existing value when OCR differs (signer name case)", () => {
    expect(coalesceOcrField("THU VÂN", "QUỐC HÙNG")).toBe("THU VÂN");
    expect(coalesceOcrField("LÊ", "NGUYỄN")).toBe("LÊ");
  });

  it("treats whitespace-only existing as empty", () => {
    expect(coalesceOcrField("  ", "001234567890")).toBe("001234567890");
  });
});

describe("mergeOcrFillEmpty", () => {
  it("merges only into empty fields", () => {
    const current = {
      legalLastName: "LÊ",
      legalFirstName: "THU VÂN",
      idNumber: "001234567890",
      issuedDate: "",
    };
    const result = mergeOcrFillEmpty(current, {
      legalLastName: "NGUYỄN",
      legalFirstName: "QUỐC HÙNG",
      idNumber: "999999999999",
      issuedDate: "2020-01-01",
    });
    expect(result.legalLastName).toBe("LÊ");
    expect(result.legalFirstName).toBe("THU VÂN");
    expect(result.idNumber).toBe("001234567890");
    expect(result.issuedDate).toBe("2020-01-01");
  });
});

describe("applyCccdParsedFillEmpty", () => {
  const emptyForm = {
    idNumber: "",
    expirationDate: "",
    residentialAddress: "",
    issuedDate: "",
    issuer: "",
    legalFirstName: "",
    legalLastName: "",
    dateOfBirth: "",
    gender: "",
  };

  it("fills all fields when form is empty", () => {
    const result = applyCccdParsedFillEmpty(emptyForm, {
      id: "001234567890",
      name: "LÊ THỊ THU VÂN",
      dob: "21/03/1989",
      gender: "Nữ",
      issued: "01/01/2020",
      extra: "Cục Cảnh sát",
    });
    expect(result.legalLastName).toBe("LÊ");
    expect(result.legalFirstName).toBe("THỊ THU VÂN");
    expect(result.idNumber).toBe("001234567890");
    expect(result.dateOfBirth).toBe("1989-03-21");
    expect(result.gender).toBe("Nữ");
    expect(result.issuedDate).toBe("2020-01-01");
    expect(result.issuer).toBe("Cục Cảnh sát");
  });

  it("does not overwrite name/id from back OCR signer misread", () => {
    const afterFront = applyCccdParsedFillEmpty(emptyForm, {
      id: "001234567890",
      name: "LÊ THỊ THU VÂN",
      dob: "21/03/1989",
      gender: "Nữ",
    });
    const afterBack = applyCccdParsedFillEmpty(afterFront, {
      id: "999999999999",
      name: "NGUYỄN QUỐC HÙNG",
      issued: "01/01/2020",
      extra: "Cục Cảnh sát",
    });
    expect(afterBack.legalLastName).toBe("LÊ");
    expect(afterBack.legalFirstName).toBe("THỊ THU VÂN");
    expect(afterBack.idNumber).toBe("001234567890");
    expect(afterBack.issuedDate).toBe("2020-01-01");
    expect(afterBack.issuer).toBe("Cục Cảnh sát");
  });

  it("maps gender to custom field name", () => {
    const form = { ...emptyForm, gender: "", pronouns: "" };
    delete (form as { gender?: string }).gender;
    const result = applyCccdParsedFillEmpty(form, { gender: "Nam" }, "pronouns");
    expect(result.pronouns).toBe("Nam");
  });
});

describe("applyBhytParsedFillEmpty", () => {
  it("fills empty insurance fields only", () => {
    const current = {
      provider: "Bệnh viện A",
      memberId: "",
      bhytName: "LÊ THỊ THU VÂN",
      bhytDob: "",
    };
    const result = applyBhytParsedFillEmpty(current, {
      id: "DN1234567890",
      name: "NGUYỄN VĂN A",
      dob: "21/03/1989",
      kcb: "Bệnh viện B",
    });
    expect(result.provider).toBe("Bệnh viện A");
    expect(result.memberId).toBe("DN1234567890");
    expect(result.bhytName).toBe("LÊ THỊ THU VÂN");
    expect(result.bhytDob).toBe("1989-03-21");
  });

  it("fills empty bhytAddress from OCR address when kcb is also present", () => {
    const current = {
      provider: "",
      bhytKcb: "",
      bhytAddress: "",
    };
    const result = applyBhytParsedFillEmpty(current, {
      address: "Công ty TNHH Trung tâm y khoa Hợp Nhân",
      kcb: "Phòng khám đa khoa (thuộc CN1 - Cty TNHH TTYK Hợp Nhân)",
    });
    expect(result.bhytAddress).toBe("Công ty TNHH Trung tâm y khoa Hợp Nhân");
    expect(result.bhytKcb).toBe("Phòng khám đa khoa (thuộc CN1 - Cty TNHH TTYK Hợp Nhân)");
    expect(result.provider).toBe("Phòng khám đa khoa (thuộc CN1 - Cty TNHH TTYK Hợp Nhân)");
  });

  it("does not overwrite existing bhytAddress", () => {
    const current = {
      bhytAddress: "Đơn vị đã nhập",
    };
    const result = applyBhytParsedFillEmpty(current, {
      address: "Công ty TNHH Trung tâm y khoa Hợp Nhân",
    });
    expect(result.bhytAddress).toBe("Đơn vị đã nhập");
  });
});

describe("checkCccdOcrQuality", () => {
  it("returns low quality when parsed is empty or undefined", () => {
    const result = checkCccdOcrQuality({ parsed: {} });
    expect(result.isLowQuality).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.filledFieldCount).toBe(0);
    expect(result.message).toContain("không đủ rõ");
  });

  it("returns low quality when fewer than 2 fields are filled", () => {
    const result = checkCccdOcrQuality({
      parsed: { id: "001234567890" },
    });
    expect(result.isLowQuality).toBe(true);
    expect(result.filledFieldCount).toBe(1);
  });

  it("returns good quality when all expected fields are filled", () => {
    const result = checkCccdOcrQuality({
      parsed: {
        id: "001234567890",
        name: "NGUYỄN VĂN A",
        dob: "01/01/1990",
        gender: "Nam",
        address: "123 Đường ABC, Quận 1",
      },
    });
    expect(result.isLowQuality).toBe(false);
    expect(result.filledFieldCount).toBe(5);
    expect(result.confidence).toBe(100);
    expect(result.message).toBeUndefined();
  });

  it("returns low quality when confidence from server is below threshold", () => {
    const result = checkCccdOcrQuality({
      parsed: {
        id: "001234567890",
        name: "NGUYỄN VĂN A",
        dob: "01/01/1990",
        gender: "Nam",
        address: "123 Đường ABC",
      },
      confidence: 50,
    });
    expect(result.isLowQuality).toBe(true);
    expect(result.confidence).toBe(50);
  });

  it("uses server confidence when provided", () => {
    const result = checkCccdOcrQuality({
      parsed: { id: "001234567890", name: "A" },
      confidence: 85,
    });
    expect(result.confidence).toBe(85);
    expect(result.isLowQuality).toBe(false);
  });
});

describe("checkBhytOcrQuality", () => {
  it("returns low quality when parsed is empty", () => {
    const result = checkBhytOcrQuality({ parsed: {} });
    expect(result.isLowQuality).toBe(true);
    expect(result.message).toContain("BHYT không đủ rõ");
  });

  it("returns good quality when expected fields are filled", () => {
    const result = checkBhytOcrQuality({
      parsed: {
        id: "DN1234567890",
        name: "NGUYỄN VĂN A",
        dob: "01/01/1990",
        kcb: "BV Quận 1",
      },
    });
    expect(result.isLowQuality).toBe(false);
    expect(result.filledFieldCount).toBe(4);
    expect(result.confidence).toBe(100);
  });
});
