import { describe, expect, it } from "vitest";
import { applyBhytParsedFillEmpty, applyCccdParsedFillEmpty } from "@/lib/cccd-ocr";
import { applyOcrForSlot, type OcrFills } from "@/lib/ocr-refill";

const emptyForm = {
  legalLastName: "", legalFirstName: "", dateOfBirth: "", gender: "",
  idNumber: "", expirationDate: "", issuedDate: "", issuer: "", residentialAddress: "",
  provider: "", memberId: "", groupNumber: "", bhytName: "", bhytDob: "", bhytGender: "",
  bhytAddress: "", bhytKcb: "", bhytKcbCode: "", bhytValidFrom: "", bhytFiveYear: "",
};
type Form = typeof emptyForm;

const cccd = (parsed: Parameters<typeof applyCccdParsedFillEmpty>[1]) =>
  (form: Form) => applyCccdParsedFillEmpty(form, parsed);
const bhyt = (parsed: Parameters<typeof applyBhytParsedFillEmpty>[1]) =>
  (form: Form) => applyBhytParsedFillEmpty(form, parsed);

const FRONT_A = cccd({ id: "001111111111", name: "LÊ THỊ THU VÂN", dob: "21/03/1989" });
const FRONT_B = cccd({ id: "002222222222", name: "TRẦN VĂN BÌNH", dob: "02/02/1990" });

describe("applyOcrForSlot", () => {
  it("should replace front CCCD data when the front image is changed and OCR runs again", () => {
    const first = applyOcrForSlot(emptyForm, {}, "front", FRONT_A);
    const second = applyOcrForSlot(first.form, first.fills, "front", FRONT_B);

    expect(second.form.idNumber).toBe("002222222222");
    expect(second.form.legalLastName).toBe("TRẦN");
    expect(second.form.legalFirstName).toBe("VĂN BÌNH");
    expect(second.form.dateOfBirth).toBe("1990-02-02");
  });

  it("should replace BHYT data when the BHYT image is changed and OCR runs again", () => {
    const first = applyOcrForSlot(emptyForm, {}, "bhyt", bhyt({ id: "DN4797911011", name: "LÊ VÂN" }));
    const second = applyOcrForSlot(first.form, first.fills, "bhyt", bhyt({ id: "HS4010101010", name: "TRẦN BÌNH" }));

    expect(second.form.memberId).toBe("HS4010101010");
    expect(second.form.bhytName).toBe("TRẦN BÌNH");
  });

  it("should overwrite a value the user edited after OCR when the same slot is re-scanned", () => {
    const first = applyOcrForSlot(emptyForm, {}, "front", FRONT_A);
    const edited = { ...first.form, legalFirstName: "THỊ THU VÂNsssss" };
    const second = applyOcrForSlot(edited, first.fills, "front", FRONT_B);

    expect(second.form.legalFirstName).toBe("VĂN BÌNH");
    expect(second.form.idNumber).toBe("002222222222");
  });

  it("should keep a value the user typed before OCR", () => {
    const typed = { ...emptyForm, idNumber: "008888888888" };
    const first = applyOcrForSlot(typed, {}, "front", FRONT_A);
    const second = applyOcrForSlot(first.form, first.fills, "front", FRONT_B);

    expect(second.form.idNumber).toBe("008888888888");
  });

  it("should not let back OCR overwrite fields filled by front OCR", () => {
    const front = applyOcrForSlot(emptyForm, {}, "front", FRONT_A);
    const back = applyOcrForSlot(front.form, front.fills, "back",
      cccd({ id: "999999999999", name: "NGUYỄN QUỐC HÙNG", issued: "01/01/2020", extra: "Cục Cảnh sát" }));
    const backAgain = applyOcrForSlot(back.form, back.fills, "back",
      cccd({ id: "999999999999", name: "NGUYỄN QUỐC HÙNG", issued: "05/05/2021", extra: "Cục CS QLHC" }));

    expect(backAgain.form.idNumber).toBe("001111111111");
    expect(backAgain.form.legalFirstName).toBe("THỊ THU VÂN");
    expect(backAgain.form.issuedDate).toBe("2021-05-05");
    expect(backAgain.form.issuer).toBe("Cục CS QLHC");
  });

  it("should leave other slots' fills untouched", () => {
    const fills: OcrFills = {};
    const front = applyOcrForSlot(emptyForm, fills, "front", FRONT_A);
    const withBhyt = applyOcrForSlot(front.form, front.fills, "bhyt", bhyt({ name: "LÊ VÂN" }));
    const frontAgain = applyOcrForSlot(withBhyt.form, withBhyt.fills, "front", FRONT_B);

    expect(frontAgain.form.bhytName).toBe("LÊ VÂN");
    expect(frontAgain.fills.bhytName?.slot).toBe("bhyt");
  });
});
