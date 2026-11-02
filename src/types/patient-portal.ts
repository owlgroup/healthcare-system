import { formatPatientProfileStatus } from "@/config/ui-labels";

/** Maps `public.patient` rows for Provider Portal (onboarding profile data). */

export type PatientPortalDetail = {
  id: string;
  user_id: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  full_name: string;
  date_of_birth: string | null;
  preferred_pronouns: string | null;
  email_address: string | null;
  phone_number: string | null;
  id_number: string | null;
  residential_address: string | null;
  id_expiration_date: string | null;
  id_issued_date: string | null;
  id_issuer: string | null;
  insurance_provider: string | null;
  member_id: string | null;
  group_number: string | null;
  bhyt_name: string | null;
  bhyt_dob: string | null;
  bhyt_gender: string | null;
  bhyt_address: string | null;
  bhyt_kcb: string | null;
  bhyt_kcb_code: string | null;
  bhyt_valid_from: string | null;
  bhyt_five_year: string | null;
  id_document_storage_path: string | null;
  id_document_back_storage_path: string | null;
  card_front_storage_path: string | null;
  avatar_storage_path: string | null;
  delivery_address: string | null;
  delivery_recipient_name: string | null;
  delivery_recipient_phone: string | null;
  delivery_notes: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  consent_accepted: boolean;
  /** DB `patient.status`: DRAFT | UNVERIFIED | ACTIVE | INACTIVE | REJECTED */
  status: PatientProfileStatus;
  rejection_reason?: string | null;
};

/** Who created the patient profile (DB `patient.created_by_role`). */
export type PatientCreatedByRole = "patient" | "doctor" | "nurse" | "admin";

export type PatientProfileStatus = "DRAFT" | "UNVERIFIED" | "ACTIVE" | "INACTIVE" | "REJECTED";

/** Row for staff patient-records table */
export type PatientRecordListRow = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  phone_number: string | null;
  email_address: string | null;
  id_number: string | null;
  member_id: string | null;
  insurance_provider: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  status: string;
  created_by_role: PatientCreatedByRole | null;
};

export function formatCreatedByRole(role: PatientCreatedByRole | null | undefined): string {
  switch (role) {
    case "patient":
      return "Bệnh nhân tự đăng ký";
    case "doctor":
      return "Bác sĩ tạo";
    case "nurse":
      return "Điều dưỡng / Y tá tạo";
    case "admin":
      return "Admin tạo";
    default:
      return "Không xác định";
  }
}

function parseCreatedByRole(value: unknown): PatientCreatedByRole | null {
  if (value === "patient" || value === "doctor" || value === "nurse" || value === "admin") {
    return value;
  }
  return null;
}

export function parsePatientProfileStatus(value: unknown): PatientProfileStatus {
  const raw = value != null ? String(value).trim().toUpperCase() : "";
  if (
    raw === "ACTIVE" ||
    raw === "UNVERIFIED" ||
    raw === "DRAFT" ||
    raw === "INACTIVE" ||
    raw === "REJECTED"
  ) {
    return raw;
  }
  return "DRAFT";
}

export type PatientListItem = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  last_visit_label: string;
  /** Derived from onboarding submission state */
  status: string;
};

function buildFullName(
  first: string | null,
  last: string | null,
  idNumber?: string | null,
  email?: string | null,
): string {
  const n = [last, first].filter((s) => s && String(s).trim()).join(" ");
  if (n.trim()) return n.trim();
  if (idNumber?.trim()) return `BN ${idNumber.trim()}`;
  if (email?.trim()) return email.trim();
  return "Bệnh nhân";
}

export function mapPatientPortalRow(row: Record<string, unknown>): PatientPortalDetail {
  const legal_first_name = row.legal_first_name != null ? String(row.legal_first_name) : null;
  const legal_last_name = row.legal_last_name != null ? String(row.legal_last_name) : null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    legal_first_name,
    legal_last_name,
    full_name: buildFullName(
      legal_first_name,
      legal_last_name,
      row.id_number != null ? String(row.id_number) : null,
      row.email_address != null ? String(row.email_address) : null,
    ),
    date_of_birth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    preferred_pronouns: row.preferred_pronouns != null ? String(row.preferred_pronouns) : null,
    email_address: row.email_address != null ? String(row.email_address) : null,
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    id_number: row.id_number != null ? String(row.id_number) : null,
    residential_address: row.residential_address != null ? String(row.residential_address) : null,
    id_expiration_date: row.id_expiration_date != null ? String(row.id_expiration_date) : null,
    id_issued_date: row.id_issued_date != null ? String(row.id_issued_date) : null,
    id_issuer: row.id_issuer != null ? String(row.id_issuer) : null,
    insurance_provider: row.insurance_provider != null ? String(row.insurance_provider) : null,
    member_id: row.member_id != null ? String(row.member_id) : null,
    group_number: row.group_number != null ? String(row.group_number) : null,
    bhyt_name: row.bhyt_name != null ? String(row.bhyt_name) : null,
    bhyt_dob: row.bhyt_dob != null ? String(row.bhyt_dob) : null,
    bhyt_gender: row.bhyt_gender != null ? String(row.bhyt_gender) : null,
    bhyt_address: row.bhyt_address != null ? String(row.bhyt_address) : null,
    bhyt_kcb: row.bhyt_kcb != null ? String(row.bhyt_kcb) : null,
    bhyt_kcb_code: row.bhyt_kcb_code != null ? String(row.bhyt_kcb_code) : null,
    bhyt_valid_from: row.bhyt_valid_from != null ? String(row.bhyt_valid_from) : null,
    bhyt_five_year: row.bhyt_five_year != null ? String(row.bhyt_five_year) : null,
    id_document_storage_path: row.id_document_storage_path != null ? String(row.id_document_storage_path) : null,
    id_document_back_storage_path: row.id_document_back_storage_path != null ? String(row.id_document_back_storage_path) : null,
    card_front_storage_path: row.card_front_storage_path != null ? String(row.card_front_storage_path) : null,
    avatar_storage_path: row.avatar_storage_path != null ? String(row.avatar_storage_path) : null,
    delivery_address: row.delivery_address != null ? String(row.delivery_address) : null,
    delivery_recipient_name: row.delivery_recipient_name != null ? String(row.delivery_recipient_name) : null,
    delivery_recipient_phone: row.delivery_recipient_phone != null ? String(row.delivery_recipient_phone) : null,
    delivery_notes: row.delivery_notes != null ? String(row.delivery_notes) : null,
    submitted_at: row.submitted_at != null ? String(row.submitted_at) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    consent_accepted: Boolean(row.consent_accepted),
    status: parsePatientProfileStatus(row.status),
    rejection_reason: row.rejection_reason != null ? String(row.rejection_reason) : null,
  };
}

export function mapPatientRecordListRow(row: Record<string, unknown>): PatientRecordListRow {
  const legal_first_name = row.legal_first_name != null ? String(row.legal_first_name) : null;
  const legal_last_name = row.legal_last_name != null ? String(row.legal_last_name) : null;
  const submitted_at = row.submitted_at != null ? String(row.submitted_at) : null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    full_name: buildFullName(
      legal_first_name,
      legal_last_name,
      row.id_number != null ? String(row.id_number) : null,
      row.email_address != null ? String(row.email_address) : null,
    ),
    date_of_birth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    email_address: row.email_address != null ? String(row.email_address) : null,
    id_number: row.id_number != null ? String(row.id_number) : null,
    member_id: row.member_id != null ? String(row.member_id) : null,
    insurance_provider: row.insurance_provider != null ? String(row.insurance_provider) : null,
    submitted_at,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    status: formatPatientProfileStatus(parsePatientProfileStatus(row.status)),
    created_by_role: parseCreatedByRole(row.created_by_role),
  };
}

/** Base list fields; add `last_visit_label` and `status` in the query layer (e.g. with date-fns). */
export function mapPatientListRowBase(row: Record<string, unknown>) {
  const legal_first_name = row.legal_first_name != null ? String(row.legal_first_name) : null;
  const legal_last_name = row.legal_last_name != null ? String(row.legal_last_name) : null;
  const full_name = buildFullName(
    legal_first_name,
    legal_last_name,
    row.id_number != null ? String(row.id_number) : null,
    row.email_address != null ? String(row.email_address) : null,
  );
  const submitted_at = row.submitted_at != null ? String(row.submitted_at) : null;

  return {
    id: String(row.id),
    full_name,
    date_of_birth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    submitted_at,
  };
}
