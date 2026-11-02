import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapPatientPortalRow,
  mapPatientRecordListRow,
  type PatientCreatedByRole,
  type PatientPortalDetail,
  type PatientRecordListRow,
} from "@/types/patient-portal";
import { decryptFields } from "@/lib/crypto";

// Sensitive patient fields that need decryption
const PATIENT_SENSITIVE_FIELDS = [
  'id_number',
  'phone_number',
  'residential_address',
  'member_id',
  'bhyt_address',
] as const;

async function decryptPatientRow<T extends Record<string, unknown>>(row: T): Promise<T> {
  return decryptFields(row, PATIENT_SENSITIVE_FIELDS as unknown as (keyof T)[]);
}

/** Maps PostgREST/Postgres delete errors to user-facing Vietnamese copy. */
export function mapPatientRecordDeleteError(message: string): string {
  if (
    message.includes("appointments_profile_id_fkey") ||
    message.includes('on table "appointments"')
  ) {
    return "Không thể xóa hồ sơ vì bệnh nhân còn lịch hẹn. Vui lòng hủy hoặc xóa các lịch hẹn trước.";
  }
  if (message.includes("violates foreign key") || message.includes("23503")) {
    return "Không thể xóa hồ sơ vì dữ liệu này đang được sử dụng ở nơi khác.";
  }
  return message;
}

const PATIENT_LIST_SELECT =
  "id, user_id, legal_first_name, legal_last_name, date_of_birth, phone_number, email_address, id_number, member_id, insurance_provider, submitted_at, updated_at, created_by_role, created_at, status";

export type PatientRecordStatusFilter =
  | "all"
  | "active"
  | "unverified"
  | "draft"
  | "inactive"
  | "rejected";

const STATUS_FILTER_TO_DB: Record<Exclude<PatientRecordStatusFilter, "all">, string> = {
  active: "ACTIVE",
  unverified: "UNVERIFIED",
  draft: "DRAFT",
  inactive: "INACTIVE",
  rejected: "REJECTED",
};

export type PatientReviewAction = "approve" | "reject";

/** Maps review RPC errors to user-facing Vietnamese copy. */
export function mapPatientRecordReviewError(message: string): string {
  if (message.includes("FORBIDDEN") || message.includes("UNAUTHORIZED")) {
    return "Bạn không có quyền phê duyệt hồ sơ.";
  }
  if (message.includes("INVALID_STATUS")) {
    return "Chỉ có thể duyệt hồ sơ đang ở trạng thái Đã nộp.";
  }
  if (message.includes("REASON_REQUIRED")) {
    return "Vui lòng nhập lý do từ chối.";
  }
  if (message.includes("NOT_FOUND")) {
    return "Không tìm thấy hồ sơ.";
  }
  return message;
}

export async function reviewPatientProfile(
  supabase: SupabaseClient,
  patientId: string,
  action: PatientReviewAction,
  reason?: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_review_patient_profile", {
    p_patient_id: patientId,
    p_action: action,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    return { error: new Error(mapPatientRecordReviewError(error.message)) };
  }
  return { error: null };
}

export type PatientRecordSortField = "full_name" | "date_of_birth" | "updated_at";
export type PatientRecordSortDir = "asc" | "desc";

export type PatientRecordsListParams = {
  search?: string;
  page?: number;
  limit?: number;
  status?: PatientRecordStatusFilter;
  createdByRole?: PatientCreatedByRole | "all";
  dateFrom?: string;
  dateTo?: string;
  sortBy?: PatientRecordSortField;
  sortDir?: PatientRecordSortDir;
};

export type PatientRecordsListResult = {
  rows: PatientRecordListRow[];
  total: number;
  error: Error | null;
};

type SearchPatientsRpcPayload = {
  total?: number;
  rows?: Record<string, unknown>[] | null;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function buildPatientSearchOrFilter(search: string): string {
  const pattern = `%${escapeIlikePattern(search)}%`;
  return [
    `legal_first_name.ilike.${pattern}`,
    `legal_last_name.ilike.${pattern}`,
    `phone_number.ilike.${pattern}`,
    `email_address.ilike.${pattern}`,
    `id_number.ilike.${pattern}`,
    `member_id.ilike.${pattern}`,
    `insurance_provider.ilike.${pattern}`,
  ].join(",");
}

function applyPatientListFilters<
  T extends {
    or: (filters: string) => T;
    eq: (column: string, value: string) => T;
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
  },
>(query: T, params: PatientRecordsListParams): T {
  let next = query;
  const search = params.search?.trim();
  if (search) {
    next = next.or(buildPatientSearchOrFilter(search));
  }
  if (params.status && params.status !== "all") {
    next = next.eq("status", STATUS_FILTER_TO_DB[params.status]);
  }
  if (params.createdByRole && params.createdByRole !== "all") {
    next = next.eq("created_by_role", params.createdByRole);
  }
  if (params.dateFrom) {
    next = next.gte("created_at", `${params.dateFrom}T00:00:00`);
  }
  if (params.dateTo) {
    next = next.lte("created_at", `${params.dateTo}T23:59:59`);
  }
  return next;
}

function applyPatientListSort<
  T extends { order: (column: string, options?: { ascending?: boolean }) => T },
>(query: T, params: PatientRecordsListParams): T {
  const ascending = params.sortDir === "asc";
  switch (params.sortBy) {
    case "full_name":
      return query.order("legal_last_name", { ascending }).order("legal_first_name", { ascending });
    case "date_of_birth":
      return query.order("date_of_birth", { ascending, nullsFirst: false });
    case "updated_at":
    default:
      return query.order("updated_at", { ascending, nullsFirst: false });
  }
}

async function searchPatientRecordsFallback(
  supabase: SupabaseClient,
  params: PatientRecordsListParams,
): Promise<PatientRecordsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 10));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("patient")
    .select(PATIENT_LIST_SELECT, { count: "exact" });

  query = applyPatientListFilters(query, params);
  query = applyPatientListSort(query, params);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return { rows: [], total: 0, error: new Error(error.message) };
  }

  // Decrypt sensitive fields before mapping
  const decryptedData = await Promise.all(
    (data ?? []).map(row => decryptPatientRow(row as Record<string, unknown>))
  );

  const rows = decryptedData.map((row) =>
    mapPatientRecordListRow(row as Record<string, unknown>),
  );
  return { rows, total: count ?? rows.length, error: null };
}

/** Tìm kiếm + lọc + sắp xếp + phân trang hồ sơ bệnh nhân cho staff. */
export async function searchPatientRecords(
  supabase: SupabaseClient,
  params: PatientRecordsListParams = {},
): Promise<PatientRecordsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 10));
  const search = params.search?.trim() || null;
  const status =
    params.status && params.status !== "all" ? STATUS_FILTER_TO_DB[params.status] : null;
  const createdByRole =
    params.createdByRole && params.createdByRole !== "all" ? params.createdByRole : null;

  const { data, error } = await supabase.rpc("search_patients_for_staff", {
    p_query: search,
    p_page: page,
    p_limit: limit,
    p_status: status,
    p_created_by_role: createdByRole,
    p_date_from: params.dateFrom || null,
    p_date_to: params.dateTo || null,
    p_sort_by: params.sortBy ?? "updated_at",
    p_sort_dir: params.sortDir ?? "desc",
  });

  if (error) {
    if (
      error.message.includes("search_patients_for_staff") ||
      error.code === "PGRST202"
    ) {
      return searchPatientRecordsFallback(supabase, params);
    }
    return { rows: [], total: 0, error: new Error(error.message) };
  }

  const payload = (data ?? {}) as SearchPatientsRpcPayload;

  // Decrypt sensitive fields before mapping
  const decryptedRows = await Promise.all(
    (payload.rows ?? []).map(row => decryptPatientRow(row as Record<string, unknown>))
  );

  const rows = decryptedRows.map((row) =>
    mapPatientRecordListRow(row as Record<string, unknown>),
  );

  return {
    rows,
    total: Number(payload.total ?? 0),
    error: null,
  };
}

/** Lấy N hồ sơ mới cập nhật cho dashboard (fallback bảng patient nếu RPC lỗi). */
export async function fetchRecentPatientRecords(
  supabase: SupabaseClient,
  limit = 5,
): Promise<PatientRecordsListResult> {
  const params: PatientRecordsListParams = {
    page: 1,
    limit,
    sortBy: "updated_at",
    sortDir: "desc",
  };

  const primary = await searchPatientRecords(supabase, params);
  if (!primary.error && primary.rows.length > 0) {
    return primary;
  }

  const fallback = await searchPatientRecordsFallback(supabase, params);
  if (fallback.rows.length > 0) {
    return fallback;
  }

  return primary.error ? primary : fallback;
}

/** @deprecated Dùng `searchPatientRecords`. */
export async function listPatientRecords(
  supabase: SupabaseClient,
): Promise<{ rows: PatientRecordListRow[]; error: Error | null }> {
  const { rows, error } = await searchPatientRecords(supabase, {
    page: 1,
    limit: 100,
  });
  return { rows, error };
}

export async function getPatientRecordById(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ record: PatientPortalDetail | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("get_patient_for_staff", {
    p_patient_id: patientId,
  });

  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      // Decrypt sensitive fields before mapping
      const decrypted = await decryptPatientRow(row as Record<string, unknown>);
      return {
        record: mapPatientPortalRow(decrypted),
        error: null,
      };
    }
  }

  const { data: direct, error: directError } = await supabase
    .from("patient")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (directError) {
    return { record: null, error: new Error(directError.message) };
  }
  if (!direct) {
    return { record: null, error: null };
  }
  // Decrypt sensitive fields before mapping
  const decrypted = await decryptPatientRow(direct as Record<string, unknown>);
  return { record: mapPatientPortalRow(decrypted), error: null };
}
