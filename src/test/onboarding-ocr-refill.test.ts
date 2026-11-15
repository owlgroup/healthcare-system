import { describe, expect, it } from "vitest";
import { mapBhytParsedToInsuranceUpdates, mapCccdParsedToFormUpdates } from "@/lib/cccd-ocr";
import { applyOnboardingOcr } from "@/lib/onboarding-ocr-refill";
import type { OnboardingFormData } from "@/hooks/useOnboardingForm";

const emptyData: OnboardingFormData = {
  personal: {
    legalFirstName: "", legalLastName: "", dateOfBirth: "", phoneNumber: "", email: "", pronouns: "",
  },
  identity: {
    idNumber: "", expirationDate: "", residentialAddress: "", issuedDate: "", issuer: "",
    idFileName: "", idBackFileName: "",
  },
  insurance: {
    provider: "", memberId: "", groupNumber: "", cardFrontFileName: "", bhytName: "", bhytDob: "",
    bhytGender: "", bhytAddress: "", bhytKcb: "", bhytKcbCode: "", bhytValidFrom: "", bhytFiveYear: "",
  },
  acceptedPrivacy: false,
};

const cccd = (parsed: Parameters<typeof mapCccdParsedToFormUpdates>[0]) => {
  const { identity, personal } = mapCccdParsedToFormUpdates(parsed);
  return { identity, personal };
};
const bhyt = (parsed: Parameters<typeof mapBhytParsedToInsuranceUpdates>[0]) => ({
  insurance: mapBhytParsedToInsuranceUpdates(parsed),
});

const FRONT_A = cccd({ id: "001111111111", name: "LÊ THỊ THU VÂN", dob: "21/03/1989" });
const FRONT_B = cccd({ id: "002222222222", name: "TRẦN VĂN BÌNH", dob: "02/02/1990" });

describe("applyOnboardingOcr", () => {
  it("should overwrite front CCCD data when the front image is OCR'd again", () => {
    const first = applyOnboardingOcr(emptyData, {}, "front", FRONT_A);
    const second = applyOnboardingOcr(first.data, first.fills, "front", FRONT_B);

    expect(second.data.identity.idNumber).toBe("002222222222");
    expect(second.data.personal.legalLastName).toBe("TRẦN");
    expect(second.data.personal.legalFirstName).toBe("VĂN BÌNH");
    expect(second.data.personal.dateOfBirth).toBe("1990-02-02");
  });

  it("should overwrite a value the user edited after OCR when the same slot is re-scanned", () => {
    const first = applyOnboardingOcr(emptyData, {}, "front", FRONT_A);
    const edited = {
      ...first.data,
      personal: { ...first.data.personal, legalFirstName: "SỬA TAY" },
    };
    const second = applyOnboardingOcr(edited, first.fills, "front", FRONT_B);

    expect(second.data.personal.legalFirstName).toBe("VĂN BÌNH");
  });

  it("should overwrite BHYT data when the BHYT image is OCR'd again", () => {
    const first = applyOnboardingOcr(emptyData, {}, "bhyt", bhyt({ id: "DN4797911011", name: "LÊ VÂN" }));
    const second = applyOnboardingOcr(first.data, first.fills, "bhyt",
      bhyt({ id: "HS4010101010", name: "TRẦN BÌNH" }));

    expect(second.data.insurance.memberId).toBe("HS4010101010");
    expect(second.data.insurance.bhytName).toBe("TRẦN BÌNH");
  });

  it("should keep a value the user typed before any OCR", () => {
    const typed = { ...emptyData, identity: { ...emptyData.identity, idNumber: "008888888888" } };
    const first = applyOnboardingOcr(typed, {}, "front", FRONT_A);
    const second = applyOnboardingOcr(first.data, first.fills, "front", FRONT_B);

    expect(second.data.identity.idNumber).toBe("008888888888");
  });

  it("should not let back OCR overwrite fields filled by front OCR", () => {
    const front = applyOnboardingOcr(emptyData, {}, "front", FRONT_A);
    const back = applyOnboardingOcr(front.data, front.fills, "back",
      cccd({ id: "999999999999", name: "NGUYỄN QUỐC HÙNG", issued: "01/01/2020", extra: "Cục Cảnh sát" }));
    const backAgain = applyOnboardingOcr(back.data, back.fills, "back",
      cccd({ id: "999999999999", issued: "05/05/2021", extra: "Cục CS QLHC" }));

    expect(backAgain.data.identity.idNumber).toBe("001111111111");
    expect(backAgain.data.personal.legalFirstName).toBe("THỊ THU VÂN");
    expect(backAgain.data.identity.issuedDate).toBe("2021-05-05");
    expect(backAgain.data.identity.issuer).toBe("Cục CS QLHC");
  });

  it("should preserve non-OCR fields such as uploaded file names and privacy consent", () => {
    const start = {
      ...emptyData,
      acceptedPrivacy: true,
      identity: { ...emptyData.identity, idFileName: "front.jpg" },
    };
    const result = applyOnboardingOcr(start, {}, "front", FRONT_A);

    expect(result.data.identity.idFileName).toBe("front.jpg");
    expect(result.data.acceptedPrivacy).toBe(true);
  });
});
