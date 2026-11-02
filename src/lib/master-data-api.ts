import { supabase } from '@/lib/supabase';
import type {
  AuditLogEntry,
  Doctor,
  DoctorSchedule,
  Facility,
  MasterDataListParams,
  MasterDataListResult,
  AuditLogListParams,
  QuestionCategory,
  Room,
  Service,
  Specialty,
} from '@/types/master-data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string { return String(v ?? ''); }
function strNull(v: unknown): string | null { return v != null ? String(v) : null; }
function numNull(v: unknown): number | null { return v != null ? Number(v) : null; }
function bool(v: unknown): boolean { return Boolean(v); }

async function softDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_master_record', {
    p_table: table,
    p_id:    id,
  });
  if (error) throw new Error(mapMasterDataError(error.message));
}

export function mapMasterDataError(msg: string): string {
  if (msg.includes('HAS_ACTIVE_DEPENDENCIES'))
    return 'Không thể vô hiệu hóa: còn lịch hẹn / slot đang hoạt động liên quan.';
  if (msg.includes('FORBIDDEN'))
    return 'Bạn không có quyền thực hiện thao tác này.';
  return msg;
}

function mapDeleteError(msg: string): string {
  if (msg.includes('violates foreign key') || msg.includes('23503'))
    return 'Không thể xóa: bản ghi đang được sử dụng ở nơi khác.';
  return msg;
}

async function hardDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(mapDeleteError(error.message));
}

type RpcListPayload = { total?: number; rows?: unknown[] };

function rpcStatusParam(status?: MasterDataListParams['status']): string | null {
  if (!status || status === 'all') return null;
  return status;
}

async function callMasterDataListRpc<T>(
  rpc: string,
  params: MasterDataListParams,
): Promise<MasterDataListResult<T>> {
  const { data, error } = await supabase.rpc(rpc, {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 6,
    p_status: rpcStatusParam(params.status),
  });
  if (error) throw new Error(mapMasterDataError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as T[],
  };
}

// ─── Specialties ─────────────────────────────────────────────────────────────

export async function listSpecialtiesAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<Specialty>> {
  return callMasterDataListRpc<Specialty>('list_specialties_admin', params);
}

export async function fetchSpecialtiesAdmin(): Promise<Specialty[]> {
  const { data, error } = await supabase
    .from('specialties')
    .select('id, name, description, icon, is_active, created_at')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Specialty[];
}

export async function upsertSpecialty(
  payload: Partial<Specialty> & { name: string },
): Promise<void> {
  const row = {
    name:        payload.name.trim(),
    description: strNull(payload.description),
    icon:        strNull(payload.icon),
  };
  const active = payload.is_active ?? true;

  if (payload.id) {
    if (!active) await deactivateSpecialty(payload.id);
    const updateRow = active ? { ...row, is_active: true } : row;
    const { error } = await supabase.from('specialties').update(updateRow).eq('id', payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('specialties').insert({ ...row, is_active: active });
    if (error) throw new Error(error.message);
  }
}

export async function deactivateSpecialty(id: string): Promise<void> {
  return softDelete('specialties', id);
}

export async function deleteSpecialty(id: string): Promise<void> {
  return hardDelete('specialties', id);
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function listServicesAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<Service>> {
  const result = await callMasterDataListRpc<Record<string, unknown>>('list_services_admin', params);
  return {
    total: result.total,
    rows: result.rows.map((r) => ({
      id:               str(r.id),
      name:             str(r.name),
      description:      strNull(r.description),
      specialty_id:     strNull(r.specialty_id),
      specialty_name:   strNull(r.specialty_name) ?? '—',
      price_vnd:        numNull(r.price_vnd),
      duration_minutes: Number(r.duration_minutes ?? 30),
      is_active:        bool(r.is_active),
      created_at:       str(r.created_at),
    })),
  };
}

export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, specialty_id, price_vnd, duration_minutes, is_active, created_at, specialties(name)')
    .order('name');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:               str(r.id),
    name:             str(r.name),
    description:      strNull(r.description),
    specialty_id:     strNull(r.specialty_id),
    specialty_name:   (r.specialties as { name: string } | null)?.name ?? '—',
    price_vnd:        numNull(r.price_vnd),
    duration_minutes: Number(r.duration_minutes ?? 30),
    is_active:        bool(r.is_active),
    created_at:       str(r.created_at),
  }));
}

export async function upsertService(
  payload: Partial<Service> & { name: string },
): Promise<void> {
  const row = {
    name:             payload.name.trim(),
    description:      strNull(payload.description),
    specialty_id:     payload.specialty_id ?? null,
    price_vnd:        payload.price_vnd ?? null,
    duration_minutes: payload.duration_minutes ?? 30,
    is_active:        payload.is_active ?? true,
  };
  const { error } = payload.id
    ? await supabase.from('services').update(row).eq('id', payload.id)
    : await supabase.from('services').insert(row);
  if (error) throw new Error(error.message);
}

export async function deactivateService(id: string): Promise<void> {
  const { error } = await supabase
    .from('services').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteService(id: string): Promise<void> {
  return hardDelete('services', id);
}

// ─── Facilities ───────────────────────────────────────────────────────────────

export async function listFacilitiesAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<Facility>> {
  const result = await callMasterDataListRpc<Record<string, unknown>>('list_facilities_admin', params);
  return {
    total: result.total,
    rows: result.rows.map((r) => ({
      id:         str(r.id),
      name:       str(r.name),
      code:       strNull(r.code),
      address:    strNull(r.address),
      phone:      strNull(r.phone),
      is_active:  bool(r.is_active ?? true),
      created_at: str(r.created_at),
    })),
  };
}

export async function fetchFacilities(): Promise<Facility[]> {
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, code, address, phone, is_active, created_at')
    .order('name');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:         str(r.id),
    name:       str(r.name),
    code:       strNull(r.code),
    address:    strNull(r.address),
    phone:      strNull(r.phone),
    is_active:  bool(r.is_active ?? true),
    created_at: str(r.created_at),
  }));
}

export async function upsertFacility(
  payload: Partial<Facility> & { name: string },
): Promise<void> {
  const row = {
    name:    payload.name.trim(),
    code:    strNull(payload.code),
    address: strNull(payload.address),
    phone:   strNull(payload.phone),
  };
  const active = payload.is_active ?? true;

  if (payload.id) {
    if (!active) await deactivateFacility(payload.id);
    const updateRow = active ? { ...row, is_active: true } : row;
    const { error } = await supabase.from('facilities').update(updateRow).eq('id', payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('facilities').insert({ ...row, is_active: active });
    if (error) throw new Error(error.message);
  }
}

export async function deactivateFacility(id: string): Promise<void> {
  return softDelete('facilities', id);
}

export async function deleteFacility(id: string): Promise<void> {
  return hardDelete('facilities', id);
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function listRoomsAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<Room>> {
  const result = await callMasterDataListRpc<Record<string, unknown>>('list_rooms_admin', params);
  return {
    total: result.total,
    rows: result.rows.map((r) => ({
      id:            str(r.id),
      facility_id:   str(r.facility_id),
      facility_name: strNull(r.facility_name) ?? '—',
      name:          str(r.name),
      room_number:   strNull(r.room_number),
      capacity:      Number(r.capacity ?? 1),
      equipment:     strNull(r.equipment),
      is_active:     bool(r.is_active),
      created_at:    str(r.created_at),
    })),
  };
}

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, facility_id, name, room_number, capacity, equipment, is_active, created_at, facilities(name)')
    .order('name');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:           str(r.id),
    facility_id:  str(r.facility_id),
    facility_name: (r.facilities as { name: string } | null)?.name ?? '—',
    name:         str(r.name),
    room_number:  strNull(r.room_number),
    capacity:     Number(r.capacity ?? 1),
    equipment:    strNull(r.equipment),
    is_active:    bool(r.is_active),
    created_at:   str(r.created_at),
  }));
}

export async function upsertRoom(
  payload: Partial<Room> & { name: string; facility_id: string },
): Promise<void> {
  const row = {
    facility_id: payload.facility_id,
    name:        payload.name.trim(),
    room_number: strNull(payload.room_number),
    capacity:    payload.capacity ?? 1,
    equipment:   strNull(payload.equipment),
  };
  const active = payload.is_active ?? true;

  if (payload.id) {
    if (!active) await deactivateRoom(payload.id);
    const updateRow = active ? { ...row, is_active: true } : row;
    const { error } = await supabase.from('rooms').update(updateRow).eq('id', payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('rooms').insert({ ...row, is_active: active });
    if (error) throw new Error(error.message);
  }
}

export async function deactivateRoom(id: string): Promise<void> {
  return softDelete('rooms', id);
}

export async function deleteRoom(id: string): Promise<void> {
  return hardDelete('rooms', id);
}

// ─── Doctor Schedules ─────────────────────────────────────────────────────────

export async function fetchDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, email, specialty')
    .eq('role', 'doctor')
    .eq('status', 'active')
    .order('full_name');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    user_id:   str(r.user_id),
    full_name: strNull(r.full_name),
    email:     str(r.email),
    specialty: strNull(r.specialty),
  }));
}

export async function listDoctorSchedulesAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<DoctorSchedule>> {
  const result = await callMasterDataListRpc<Record<string, unknown>>('list_doctor_schedules_admin', params);
  return {
    total: result.total,
    rows: result.rows.map((r) => {
      const ex = Array.isArray(r.exceptions) ? (r.exceptions as string[]) : [];
      return {
        id:                    str(r.id),
        doctor_id:             str(r.doctor_id),
        doctor_name:           strNull(r.doctor_name) ?? '—',
        specialty_id:          str(r.specialty_id),
        specialty_name:        strNull(r.specialty_name) ?? '—',
        facility_id:           str(r.facility_id),
        facility_name:         strNull(r.facility_name) ?? '—',
        room_id:               strNull(r.room_id),
        room_name:             strNull(r.room_name),
        work_days:             Array.isArray(r.work_days) ? (r.work_days as number[]) : [],
        work_start_time:       str(r.work_start_time),
        work_end_time:         str(r.work_end_time),
        slot_duration_minutes: Number(r.slot_duration_minutes ?? 30),
        exceptions:            ex,
        valid_from:            str(r.valid_from),
        valid_until:           strNull(r.valid_until),
        is_active:             bool(r.is_active),
        created_at:            str(r.created_at),
      } satisfies DoctorSchedule;
    }),
  };
}

export async function fetchDoctorSchedules(): Promise<DoctorSchedule[]> {
  const { data, error } = await supabase
    .from('doctor_schedules')
    .select(`
      id, doctor_id, specialty_id, facility_id, room_id,
      work_days, work_start_time, work_end_time, slot_duration_minutes,
      exceptions, valid_from, valid_until, is_active, created_at,
      user_profiles(full_name, email),
      specialties(name),
      facilities(name),
      rooms(name)
    `)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const up = r.user_profiles as { full_name: string | null; email: string } | null;
    const ex = Array.isArray(r.exceptions) ? (r.exceptions as string[]) : [];
    return {
      id:                   str(r.id),
      doctor_id:            str(r.doctor_id),
      doctor_name:          up?.full_name ?? up?.email ?? '—',
      specialty_id:         str(r.specialty_id),
      specialty_name:       (r.specialties as { name: string } | null)?.name ?? '—',
      facility_id:          str(r.facility_id),
      facility_name:        (r.facilities as { name: string } | null)?.name ?? '—',
      room_id:              strNull(r.room_id),
      room_name:            (r.rooms as { name: string } | null)?.name ?? null,
      work_days:            Array.isArray(r.work_days) ? (r.work_days as number[]) : [],
      work_start_time:      str(r.work_start_time),
      work_end_time:        str(r.work_end_time),
      slot_duration_minutes: Number(r.slot_duration_minutes ?? 30),
      exceptions:           ex,
      valid_from:           str(r.valid_from),
      valid_until:          strNull(r.valid_until),
      is_active:            bool(r.is_active),
      created_at:           str(r.created_at),
    } satisfies DoctorSchedule;
  });
}

export async function upsertDoctorSchedule(
  payload: Omit<DoctorSchedule, 'id' | 'doctor_name' | 'specialty_name' | 'facility_name' | 'room_name' | 'created_at'> & { id?: string },
): Promise<void> {
  const row = {
    doctor_id:            payload.doctor_id,
    specialty_id:         payload.specialty_id,
    facility_id:          payload.facility_id,
    room_id:              payload.room_id ?? null,
    work_days:            payload.work_days,
    work_start_time:      payload.work_start_time,
    work_end_time:        payload.work_end_time,
    slot_duration_minutes: payload.slot_duration_minutes,
    exceptions:           payload.exceptions,
    valid_from:           payload.valid_from,
    valid_until:          payload.valid_until ?? null,
    is_active:            payload.is_active ?? true,
  };
  const { error } = payload.id
    ? await supabase.from('doctor_schedules').update(row).eq('id', payload.id)
    : await supabase.from('doctor_schedules').insert(row);
  if (error) throw new Error(error.message);
}

export async function deactivateDoctorSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('doctor_schedules').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteDoctorSchedule(id: string): Promise<void> {
  return hardDelete('doctor_schedules', id);
}

// ─── Question Categories ─────────────────────────────────────────────────────

export async function listQuestionCategoriesAdmin(
  params: MasterDataListParams = {},
): Promise<MasterDataListResult<QuestionCategory>> {
  return callMasterDataListRpc<QuestionCategory>('list_question_categories_admin', params);
}

export async function fetchQuestionCategories(): Promise<QuestionCategory[]> {
  const { data, error } = await supabase
    .from('question_categories')
    .select('id, name, description, sort_order, is_active, created_at')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestionCategory[];
}

export async function upsertQuestionCategory(
  payload: Partial<QuestionCategory> & { name: string },
): Promise<void> {
  const row = {
    name:        payload.name.trim(),
    description: strNull(payload.description),
    sort_order:  payload.sort_order ?? 0,
    is_active:   payload.is_active ?? true,
  };
  const { error } = payload.id
    ? await supabase.from('question_categories').update(row).eq('id', payload.id)
    : await supabase.from('question_categories').insert(row);
  if (error) throw new Error(error.message);
}

export async function deactivateQuestionCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('question_categories').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestionCategory(id: string): Promise<void> {
  return hardDelete('question_categories', id);
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export async function listAuditLogAdmin(
  params: AuditLogListParams = {},
): Promise<MasterDataListResult<AuditLogEntry>> {
  const { data, error } = await supabase.rpc('list_master_data_audit_log', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 6,
    p_table_name: params.tableName?.trim() || null,
  });
  if (error) throw new Error(mapMasterDataError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as AuditLogEntry[],
  };
}

export async function fetchAuditLog(tableName?: string, limit = 50): Promise<AuditLogEntry[]> {
  let q = supabase
    .from('master_data_audit_log')
    .select('id, table_name, record_id, action, changed_by, changed_at, old_data, new_data')
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (tableName) q = q.eq('table_name', tableName);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogEntry[];
}

// ─── Slot generation trigger ─────────────────────────────────────────────────

export async function triggerSlotGeneration(): Promise<{ slots_created: number }> {
  const { data, error } = await supabase.rpc('generate_slots_30d');
  if (error) throw new Error(error.message);
  return data as { slots_created: number };
}
