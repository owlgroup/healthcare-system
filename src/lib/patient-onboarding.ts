import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingFormData, PatientOnboardingUploadFiles } from "@/hooks/useOnboardingForm";
import { encrypt } from "@/lib/crypto";

function sanitizeStorageSegment(fileName: string): string {
  const ascii = fileName.trim().replace(/[^\w.\-]+/g, "_");
  return ascii.slice(0, 120) || "file";
}

function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t === "" ? null : t;
}

export async function submitPatientProfile(
  supabase: SupabaseClient,
  userId: string,
  form: OnboardingFormData,
  files: PatientOnboardingUploadFiles,
): Promise<{ error: Error | null }> {
  const ts = Date.now();
  let idPath: string | null = null;
  let idBackPath: string | null = null;
  let frontPath: string | null = null;

  if (files.idFile) {
    idPath = `${userId}/id_front_${ts}_${sanitizeStorageSegment(files.idFile.name)}`;
    const { error } = await supabase.storage.from("identity-documents").upload(idPath, files.idFile, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) return { error: new Error(error.message) };
  }

  if (files.idBackFile) {
    idBackPath = `${userId}/id_back_${ts}_${sanitizeStorageSegment(files.idBackFile.name)}`;
    const { error } = await supabase.storage.from("identity-documents").upload(idBackPath, files.idBackFile, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) return { error: new Error(error.message) };
  }

  if (files.cardFrontFile) {
    frontPath = `${userId}/card_front_${ts}_${sanitizeStorageSegment(files.cardFrontFile.name)}`;
    const { error } = await supabase.storage.from("insurance-cards").upload(frontPath, files.cardFrontFile, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) return { error: new Error(error.message) };
  }

  const submittedAt = new Date().toISOString();

  // Encrypt sensitive fields before saving
  const encryptField = async (value: string | null) => value ? await encrypt(value) : null;

  const row = {
    user_id: userId,
    id_document_storage_path: idPath,
    id_document_back_storage_path: idBackPath,
    id_number: await encryptField(emptyToNull(form.identity.idNumber)),
    id_expiration_date: emptyToNull(form.identity.expirationDate),
    residential_address: await encryptField(emptyToNull(form.identity.residentialAddress)),
    id_issued_date: emptyToNull(form.identity.issuedDate),
    id_issuer: emptyToNull(form.identity.issuer),
    legal_first_name: emptyToNull(form.personal.legalFirstName),
    legal_last_name: emptyToNull(form.personal.legalLastName),
    date_of_birth: emptyToNull(form.personal.dateOfBirth),
    phone_number: await encryptField(emptyToNull(form.personal.phoneNumber)),
    email_address: emptyToNull(form.personal.email),
    preferred_pronouns: emptyToNull(form.personal.pronouns),
    insurance_provider: emptyToNull(form.insurance.provider),
    member_id: await encryptField(emptyToNull(form.insurance.memberId)),
    group_number: emptyToNull(form.insurance.groupNumber),
    bhyt_name: emptyToNull(form.insurance.bhytName),
    bhyt_dob: emptyToNull(form.insurance.bhytDob),
    bhyt_gender: emptyToNull(form.insurance.bhytGender),
    bhyt_address: await encryptField(emptyToNull(form.insurance.bhytAddress)),
    bhyt_kcb: emptyToNull(form.insurance.bhytKcb),
    bhyt_kcb_code: emptyToNull(form.insurance.bhytKcbCode),
    bhyt_valid_from: emptyToNull(form.insurance.bhytValidFrom),
    bhyt_five_year: emptyToNull(form.insurance.bhytFiveYear),
    card_front_storage_path: frontPath,
    card_back_storage_path: null,
    consent_accepted: form.acceptedPrivacy,
    submitted_at: submittedAt,
    status: "UNVERIFIED",
    created_by: userId,
    created_by_role: "patient" as const,
  };

  const { error } = await supabase.from("patient").upsert(row, { onConflict: "user_id" });

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
