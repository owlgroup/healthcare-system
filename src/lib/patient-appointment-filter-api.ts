import type { SupabaseClient } from '@supabase/supabase-js';
import { mapPatientRecordListRow, type PatientRecordListRow } from '@/types/patient-portal';

export type PatientAppointmentFilterParams = {
  search?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  doctorId?: string;
  includeWalkIns?: boolean;
};

export type PatientAppointmentFilterResult = {
  rows: PatientRecordListRow[];
  total: number;
  error: Error | null;
};

export async function searchPatientsWithAppointments(
  supabase: SupabaseClient,
  params: PatientAppointmentFilterParams = {},
): Promise<PatientAppointmentFilterResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 10));
  const from = (page - 1) * limit;

  const hasAppointmentFilters = Boolean(
    params.dateFrom || params.dateTo || params.status || params.doctorId
  );

  if (!hasAppointmentFilters) {
    return searchPatientsOnly(supabase, params, page, limit);
  }

  const profileIds = await fetchFilteredProfileIds(supabase, params);

  if (profileIds.length === 0) {
    return { rows: [], total: 0, error: null };
  }

  let patientQuery = supabase
    .from('patient')
    .select('*', { count: 'exact' })
    .in('id', profileIds)
    .order('updated_at', { ascending: false });

  const search = params.search?.trim();
  if (search) {
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escapedSearch}%`;
    patientQuery = patientQuery.or([
      `legal_first_name.ilike.${pattern}`,
      `legal_last_name.ilike.${pattern}`,
      `phone_number.ilike.${pattern}`,
      `email_address.ilike.${pattern}`,
      `id_number.ilike.${pattern}`,
    ].join(','));
  }

  const { data, error, count } = await patientQuery.range(from, from + limit - 1);

  if (error) {
    return { rows: [], total: 0, error: new Error(error.message) };
  }

  const rows = (data ?? []).map((row) =>
    mapPatientRecordListRow(row as Record<string, unknown>)
  );

  return { rows, total: count ?? rows.length, error: null };
}

async function fetchFilteredProfileIds(
  supabase: SupabaseClient,
  params: PatientAppointmentFilterParams,
): Promise<string[]> {
  const hasDateFilter = Boolean(params.dateFrom || params.dateTo);
  const hasDoctorFilter = Boolean(params.doctorId && params.doctorId !== '__all__');
  const includeWalkIns = params.includeWalkIns ?? true;

  let query = supabase
    .from('appointments')
    .select(`
      profile_id,
      walk_in,
      created_at,
      appointment_slots (
        slot_date,
        doctor_id
      )
    `);

  if (params.status && params.status !== '__all__') {
    query = query.eq('status', params.status);
  }

  const { data: appointments, error } = await query;

  if (error || !appointments) {
    return [];
  }

  const filtered = appointments.filter((appt) => {
    const slot = appt.appointment_slots as { slot_date: string; doctor_id: string } | null;
    const isWalkIn = appt.walk_in === true;

    if (hasDoctorFilter) {
      if (isWalkIn) {
        return includeWalkIns;
      }
      if (slot?.doctor_id !== params.doctorId) {
        return false;
      }
    }

    if (hasDateFilter) {
      let apptDate: string | null = null;

      if (slot?.slot_date) {
        apptDate = slot.slot_date;
      } else if (isWalkIn && appt.created_at) {
        apptDate = appt.created_at.slice(0, 10);
      }

      if (!apptDate) {
        return false;
      }

      if (params.dateFrom && apptDate < params.dateFrom) {
        return false;
      }
      if (params.dateTo && apptDate > params.dateTo) {
        return false;
      }
    }

    return true;
  });

  return [...new Set(filtered.map((a) => a.profile_id))];
}

async function searchPatientsOnly(
  supabase: SupabaseClient,
  params: PatientAppointmentFilterParams,
  page: number,
  limit: number,
): Promise<PatientAppointmentFilterResult> {
  const from = (page - 1) * limit;

  let query = supabase
    .from('patient')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  const search = params.search?.trim();
  if (search) {
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escapedSearch}%`;
    query = query.or([
      `legal_first_name.ilike.${pattern}`,
      `legal_last_name.ilike.${pattern}`,
      `phone_number.ilike.${pattern}`,
      `email_address.ilike.${pattern}`,
      `id_number.ilike.${pattern}`,
    ].join(','));
  }

  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    return { rows: [], total: 0, error: new Error(error.message) };
  }

  const rows = (data ?? []).map((row) =>
    mapPatientRecordListRow(row as Record<string, unknown>)
  );

  return { rows, total: count ?? rows.length, error: null };
}
