import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingFormData, PatientOnboardingUploadFiles } from "@/hooks/useOnboardingForm";
import { submitPatientProfile } from "@/lib/patient-onboarding";

const upload = vi.fn();
const upsert = vi.fn();

function makeSupabase() {
  return {
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => upload(bucket, ...args),
      }),
    },
    from: () => ({
      upsert: (...args: unknown[]) => upsert(...args),
    }),
  };
}

const form: OnboardingFormData = {
  personal: {
    legalFirstName: "An",
    legalLastName: "Nguyễn",
    dateOfBirth: "1990-01-15",
    phoneNumber: "0912345678",
    email: "an@example.com",
    pronouns: "Nam",
  },
  identity: {
    idNumber: "012345678901",
    expirationDate: "2030-01-01",
    residentialAddress: "Hà Nội",
    issuedDate: "2020-01-01",
    issuer: "CA Hà Nội",
    idFileName: "",
    idBackFileName: "",
  },
  insurance: {
    provider: "BHXH",
    memberId: "DN401",
    groupNumber: "01",
    cardFrontFileName: "",
    bhytName: "",
    bhytDob: "",
    bhytGender: "",
    bhytAddress: "",
    bhytKcb: "",
    bhytKcbCode: "",
    bhytValidFrom: "",
    bhytFiveYear: "",
  },
  acceptedPrivacy: true,
};

const emptyFiles: PatientOnboardingUploadFiles = {
  idFile: null,
  idBackFile: null,
  cardFrontFile: null,
};

describe("submitPatientProfile optional uploads", () => {
  beforeEach(() => {
    upload.mockReset();
    upsert.mockReset();
    upload.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
  });

  it("should save a profile with no document files and null storage paths", async () => {
    const supabase = makeSupabase();
    const result = await submitPatientProfile(supabase as never, "user-1", form, emptyFiles);

    expect(result.error).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        id_document_storage_path: null,
        id_document_back_storage_path: null,
        card_front_storage_path: null,
      }),
      { onConflict: "user_id" },
    );
  });

  it("should upload only the provided ID front file", async () => {
    const idFile = new File(["front"], "cccd-front.jpg", { type: "image/jpeg" });
    const supabase = makeSupabase();
    const result = await submitPatientProfile(supabase as never, "user-1", form, {
      ...emptyFiles,
      idFile,
    });

    expect(result.error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      "identity-documents",
      expect.stringMatching(/^user-1\/id_front_/),
      idFile,
      { upsert: true, cacheControl: "3600" },
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id_document_storage_path: expect.stringMatching(/^user-1\/id_front_/),
        id_document_back_storage_path: null,
        card_front_storage_path: null,
      }),
      { onConflict: "user_id" },
    );
  });
});
