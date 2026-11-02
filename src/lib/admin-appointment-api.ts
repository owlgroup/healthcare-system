import { supabase } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import type {
  AdminAppointment,
  AdminAppointmentFilters,
  AdminAppointmentsListParams,
  AdminAppointmentsListResult,
  PatientSearchResult,
} from "@/types/admin-appointment";

// Helper to decrypt patient sensitive fields from appointment data
async function decryptAppointmentPatientFields(r: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decrypted = { ...r };
  if (r.patient_phone && typeof r.patient_phone === 'string') {
    decrypted.patient_phone = await decrypt(r.patient_phone);
  }
  return decrypted;
}

type SearchAdminAppointmentsRpcPayload = {
  total?: number;
  rows?: Record<string, unknown>[] | null;
};

export async function mapRpcAdminAppointmentRow(r: Record<string, unknown>): Promise<AdminAppointment> {
  // Decrypt sensitive patient fields
  const decrypted = await decryptAppointmentPatientFields(r);

  const pcFlags = (decrypted.pre_consult_flags as Record<string, unknown> | null) ?? {};
  const dpcFlags = (decrypted.pre_consult_doctor_flags as Record<string, unknown> | null) ?? {};
  const preConsultRaw = decrypted.pre_consult_status_raw as string | null;

  return {
    id: decrypted.id as string,
    patient_id: decrypted.patient_id as string,
    profile_id: decrypted.profile_id as string,
    specialty_id: decrypted.specialty_id as string,
    slot_id: (decrypted.slot_id as string) ?? null,
    status: decrypted.status as AdminAppointment["status"],
    note: (decrypted.note as string) ?? null,
    walk_in: Boolean(decrypted.walk_in),
    cancel_reason: (decrypted.cancel_reason as string) ?? null,
    cancelled_at: (decrypted.cancelled_at as string) ?? null,
    cancelled_by: (decrypted.cancelled_by as "patient" | "admin") ?? null,
    created_at: decrypted.created_at as string,
    updated_at: decrypted.updated_at as string,
    specialty_name: (decrypted.specialty_name as string) ?? null,
    specialty_icon: (decrypted.specialty_icon as string) ?? null,
    slot_date: (decrypted.slot_date as string) ?? null,
    start_time: (decrypted.start_time as string) ?? null,
    end_time: (decrypted.end_time as string) ?? null,
    doctor_id: (decrypted.doctor_id as string) ?? null,
    patient_name: (decrypted.patient_name as string) ?? null,
    patient_phone: (decrypted.patient_phone as string) ?? null,
    patient_dob: (decrypted.patient_dob as string) ?? null,
    doctor_name: (decrypted.doctor_name as string) ?? null,
    pre_consult_status: !preConsultRaw
      ? "none"
      : preConsultRaw === "SUBMITTED"
        ? "submitted"
        : "draft",
    pre_consult_doctor_exists: Boolean(r.pre_consult_doctor_exists),
    pre_consult_drug_allergy: Boolean(pcFlags.drug_allergy || dpcFlags.drug_allergy),
    pre_consult_severe_pain: Boolean(pcFlags.severe_pain || dpcFlags.severe_pain),
    has_vital_signs: Boolean(r.has_vital_signs),
  };
}

async function searchAdminAppointmentsFallback(
  params: AdminAppointmentsListParams,
): Promise<AdminAppointmentsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 10));

  const all = await fetchAdminAppointments({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    specialty_id: params.specialtyId,
    status: params.status as AdminAppointmentFilters["status"],
    doctor_id: params.doctorId,
    search: params.search,
  });

  const total = all.length;
  const from = (page - 1) * limit;
  const rows = all.slice(from, from + limit);

  return { rows, total, error: null };
}

/** Tìm kiếm + lọc + phân trang lịch hẹn cho admin portal. */
export async function searchAdminAppointments(
  params: AdminAppointmentsListParams = {},
): Promise<AdminAppointmentsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 10));
  const search = params.search?.trim() || null;
  const status =
    params.status && params.status !== "__all__" ? params.status : null;

  const { data, error } = await supabase.rpc("search_admin_appointments", {
    p_query: search,
    p_page: page,
    p_limit: limit,
    p_status: status,
    p_date_from: params.dateFrom || null,
    p_date_to: params.dateTo || null,
    p_specialty_id: params.specialtyId || null,
    p_doctor_id: params.doctorId || null,
  });

  if (error) {
    if (
      error.message.includes("search_admin_appointments") ||
      error.code === "PGRST202"
    ) {
      return searchAdminAppointmentsFallback(params);
    }
    return { rows: [], total: 0, error: new Error(mapAdminError(error.message)) };
  }

  const payload = (data ?? {}) as SearchAdminAppointmentsRpcPayload;
  const rows = await Promise.all(
    (payload.rows ?? []).map((row) => mapRpcAdminAppointmentRow(row))
  );

  return {
    rows,
    total: Number(payload.total ?? 0),
    error: null,
  };
}

// ─── Fetch appointments (direct PostgREST — no custom RPC needed) ─────────────

export async function fetchAdminAppointments(
  filters: AdminAppointmentFilters = {}
): Promise<AdminAppointment[]> {
  let query = supabase
    .from("appointments")
    .select(`
      *,
      specialties ( name, icon ),
      appointment_slots ( slot_date, start_time, end_time, doctor_id,
        user_profiles!appointment_slots_doctor_id_fkey ( full_name )
      ),
      patient ( legal_first_name, legal_last_name, phone_number, date_of_birth ),
      pre_consultations ( status, flags ),
      doctor_pre_consultations ( id, flags ),
      vital_signs ( id )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  // Server-side simple column filters
  if (filters.status)       query = query.eq("status", filters.status);
  if (filters.specialty_id) query = query.eq("specialty_id", filters.specialty_id);

  const { data, error } = await query;
  if (error) throw new Error(mapAdminError(error.message));

  let rows = (data ?? []) as Record<string, any>[];

  // Client-side filters for joined / range fields
  if (filters.date_from || filters.date_to) {
    rows = rows.filter((r) => {
      const d = (r.appointment_slots as any)?.slot_date ?? r.created_at?.slice(0, 10);
      if (!d) return false;
      if (filters.date_from && d < filters.date_from) return false;
      if (filters.date_to   && d > filters.date_to)   return false;
      return true;
    });
  } else if (filters.date) {
    rows = rows.filter((r) => {
      const d = (r.appointment_slots as any)?.slot_date ?? r.created_at?.slice(0, 10);
      return d === filters.date;
    });
  }

  if (filters.doctor_id) {
    rows = rows.filter((r) => (r.appointment_slots as any)?.doctor_id === filters.doctor_id);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => {
      const pt = r.patient as any;
      if (!pt) return false;
      return (
        pt.phone_number?.toLowerCase().includes(q) ||
        pt.legal_first_name?.toLowerCase().includes(q) ||
        pt.legal_last_name?.toLowerCase().includes(q)
      );
    });
  }

  return rows.map((r) => {
    const sl  = (r.appointment_slots as any) ?? null;
    const pt  = (r.patient          as any) ?? null;
    const sp  = (r.specialties      as any) ?? null;
    const doc = sl?.user_profiles ?? null;
    const pc  = (Array.isArray(r.pre_consultations) ? r.pre_consultations[0] : r.pre_consultations) ?? null;
    const dpc = (Array.isArray(r.doctor_pre_consultations) ? r.doctor_pre_consultations[0] : r.doctor_pre_consultations) ?? null;
    const vitalsRaw = r.vital_signs as unknown[] | null;
    const pcFlags = (pc?.flags as Record<string, unknown> | undefined) ?? {};
    const dpcFlags = (dpc?.flags as Record<string, unknown> | undefined) ?? {};

    return {
      id:            r.id,
      patient_id:    r.patient_id,
      profile_id:    r.profile_id,
      specialty_id:  r.specialty_id,
      slot_id:       r.slot_id   ?? null,
      status:        r.status,
      note:          r.note      ?? null,
      walk_in:       r.walk_in   ?? false,
      cancel_reason: r.cancel_reason ?? null,
      cancelled_at:  r.cancelled_at  ?? null,
      cancelled_by:  r.cancelled_by  ?? null,
      created_at:    r.created_at,
      updated_at:    r.updated_at,
      specialty_name: sp?.name   ?? null,
      specialty_icon: sp?.icon   ?? null,
      slot_date:  sl?.slot_date  ?? null,
      start_time: sl?.start_time ?? null,
      end_time:   sl?.end_time   ?? null,
      doctor_id:  sl?.doctor_id  ?? null,
      patient_name: [pt?.legal_last_name, pt?.legal_first_name].filter(Boolean).join(" ") || null,
      patient_phone: pt?.phone_number  ?? null,
      patient_dob:   pt?.date_of_birth ?? null,
      doctor_name:   doc?.full_name    ?? null,
      pre_consult_status: !pc ? "none" : pc.status === "SUBMITTED" ? "submitted" : "draft",
      pre_consult_doctor_exists: Boolean(dpc?.id),
      pre_consult_drug_allergy: Boolean(pcFlags.drug_allergy || dpcFlags.drug_allergy),
      pre_consult_severe_pain:  Boolean(pcFlags.severe_pain || dpcFlags.severe_pain),
      has_vital_signs: Array.isArray(vitalsRaw) && vitalsRaw.length > 0,
    } as AdminAppointment;
  });
}

// ─── Fetch all patients (for walk-in picker) ─────────────────────────────────

export async function fetchAllPatients(): Promise<PatientSearchResult[]> {
  const { data, error } = await supabase
    .from("patient")
    .select("id, user_id, legal_first_name, legal_last_name, phone_number, id_number, date_of_birth, submitted_at")
    .order("legal_last_name", { ascending: true })
    .limit(200);

  if (error) throw new Error(mapAdminError(error.message));

  // Decrypt sensitive fields (phone_number, id_number) before returning
  const decrypted = await Promise.all(
    (data ?? []).map(async (r) => ({
      profile_id:    r.id,
      patient_id:    r.user_id,
      patient_name:  [r.legal_last_name, r.legal_first_name].filter(Boolean).join(" "),
      phone_number:  r.phone_number ? await decrypt(r.phone_number) : null,
      id_number:     r.id_number    ? await decrypt(r.id_number)    : null,
      date_of_birth: r.date_of_birth ?? null,
      submitted_at:  r.submitted_at  ?? null,
    }))
  );

  return decrypted as PatientSearchResult[];
}

// ─── Search patients (client-side filter on top of fetchAllPatients) ──────────

export async function searchPatients(query: string): Promise<PatientSearchResult[]> {
  const all = await fetchAllPatients();
  if (!query.trim()) return all;

  const q = query.trim().toLowerCase();
  return all.filter((p) =>
    p.patient_name?.toLowerCase().includes(q) ||
    p.phone_number?.toLowerCase().includes(q) ||
    p.id_number?.toLowerCase().includes(q)
  );
}

// ─── Walk-in ──────────────────────────────────────────────────────────────────

export async function adminCreateWalkin(
  profileId:   string,
  specialtyId: string,
  note:        string | null
): Promise<string> {
  const { data, error } = await supabase.rpc("admin_create_walkin", {
    p_profile_id:   profileId,
    p_specialty_id: specialtyId,
    p_note:         note,
  });
  if (error) throw new Error(mapAdminError(error.message));
  return data as string;
}

// Create a patient profile for a newly created auth user (walk-in quick-create)
export async function adminInsertPatientProfile(
  userId:    string,
  firstName: string,
  lastName:  string,
  phone:     string | null,
  dob:       string | null,
  idNumber:  string | null
): Promise<string> {
  const { data, error } = await supabase.rpc("admin_insert_patient_profile", {
    p_user_id:          userId,
    p_legal_first_name: firstName,
    p_legal_last_name:  lastName,
    p_phone_number:     phone,
    p_date_of_birth:    dob,
    p_id_number:        idNumber,
  });
  if (error) throw new Error(mapAdminError(error.message));
  return data as string;
}

export async function staffCreatePatientProfile(
  firstName: string,
  lastName:  string,
  phone:     string | null,
  dob:       string | null,
  idNumber:  string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("staff_create_patient_profile", {
    p_legal_first_name: firstName,
    p_legal_last_name:  lastName,
    p_phone_number:     phone,
    p_date_of_birth:    dob,
    p_id_number:        idNumber,
  });
  if (error) throw new Error(mapAdminError(error.message));
  return data as string;
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export async function adminCheckinAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_checkin_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(mapAdminError(error.message));
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function adminCancelAppointment(
  appointmentId: string,
  reason: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const { error } = await supabase.rpc("admin_cancel_appointment", {
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) throw new Error(mapAdminError(error.message));

  const { data, error: fnErr } = await supabase.functions.invoke(
    "notify-appointment-cancelled",
    { body: { appointment_id: appointmentId, cancel_reason: reason } },
  );

  if (fnErr) {
    console.warn("[notify-cancelled]", fnErr.message);
    return { emailSent: false, emailError: fnErr.message };
  }

  const skipped = (data as Record<string, unknown>)?.skipped === true;
  return { emailSent: !skipped };
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

export async function adminRescheduleAppointment(
  appointmentId: string,
  newSlotId: string
): Promise<void> {
  const { error } = await supabase.rpc("admin_reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_new_slot_id: newSlotId,
  });
  if (error) throw new Error(mapAdminError(error.message));
}

// ─── Bulk cancel ──────────────────────────────────────────────────────────────

export async function adminBulkCancel(
  appointmentIds: string[],
  reason: string
): Promise<{ count: number; emailsSent: number }> {
  const { data, error } = await supabase.rpc("admin_bulk_cancel", {
    p_appointment_ids: appointmentIds,
    p_reason: reason,
  });
  if (error) throw new Error(mapAdminError(error.message));

  const results = await Promise.all(
    appointmentIds.map((id) =>
      supabase.functions
        .invoke("notify-appointment-cancelled", {
          body: { appointment_id: id, cancel_reason: reason },
        })
        .then(({ data: d, error: fnErr }) => {
          if (fnErr) console.warn("[notify-cancelled] bulk", id, fnErr.message);
          return !fnErr && (d as Record<string, unknown>)?.skipped !== true;
        }),
    ),
  );

  return { count: data as number, emailsSent: results.filter(Boolean).length };
}

// ─── Error mapping ────────────────────────────────────────────────────────────

export function mapAdminError(message: string): string {
  const map: Record<string, string> = {
    FORBIDDEN:          "Bạn không có quyền thực hiện thao tác này.",
    PROFILE_NOT_FOUND:  "Không tìm thấy hồ sơ bệnh nhân.",
    NOT_FOUND:          "Không tìm thấy lịch hẹn.",
    CANNOT_CHECKIN:     "Chỉ có thể tiếp nhận lịch ở trạng thái Chờ khám.",
    CANNOT_CANCEL:      "Lịch hẹn này không thể hủy.",
    CANNOT_RESCHEDULE:  "Lịch hẹn này không thể đổi giờ.",
    SLOT_UNAVAILABLE:   "Giờ khám này đã được đặt. Vui lòng chọn giờ khám khác.",
    SLOT_IN_PAST:       "Slot đã qua, không thể đặt.",
    SPECIALTY_MISMATCH: "Bác sĩ chỉ có thể tạo lịch khám không hẹn thuộc chuyên khoa của mình.",
  };
  for (const [code, msg] of Object.entries(map)) {
    if (message.includes(code)) return msg;
  }
  return message;
}
