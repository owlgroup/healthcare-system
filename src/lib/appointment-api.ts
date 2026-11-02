import { supabase } from '@/lib/supabase';
import type {
  Appointment,
  AppointmentSlot,
  BookAppointmentParams,
  Specialty,
} from '@/types/appointment';
import { format } from 'date-fns';

export type DoctorInfo = {
  doctor_id: string;
  full_name: string;
  specialty: string | null;
  facility_name: string | null;
  next_available: string | null;
};

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data, error } = await supabase
    .from('specialties')
    .select('id, name, description, icon')
    .eq('is_active', true)
    .order('name');

  if (error) throw new Error(error.message);
  return (data ?? []) as Specialty[];
}

export async function fetchDoctorsBySpecialty(
  specialtyId: string,
): Promise<DoctorInfo[]> {
  const { data, error } = await supabase.rpc('get_doctors_by_specialty', {
    p_specialty_id: specialtyId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as DoctorInfo[];
}

export async function fetchSlots(
  specialtyId: string,
  date: Date,
): Promise<AppointmentSlot[]> {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Ensure slots exist for this date (idempotent)
  await supabase.rpc('ensure_slots_exist', {
    p_specialty_id: specialtyId,
    p_date: dateStr,
  });

  const { data, error } = await supabase
    .from('appointment_slots')
    .select('id, specialty_id, slot_date, start_time, end_time, is_available')
    .eq('specialty_id', specialtyId)
    .eq('slot_date', dateStr)
    .order('start_time');

  if (error) throw new Error(error.message);
  return (data ?? []) as AppointmentSlot[];
}

export async function bookAppointment(
  params: BookAppointmentParams,
): Promise<string> {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_profile_id:   params.profile_id,
    p_specialty_id: params.specialty_id,
    p_slot_id:      params.slot_id,
    p_note:         params.note ?? null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment_id: appointmentId,
  });

  if (error) throw new Error(error.message);
}

export async function fetchMyAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, patient_id, profile_id, specialty_id, slot_id, status,
      note, qr_token, qr_expires_at, reminder_at, cancelled_at, created_at,
      specialties (name),
      appointment_slots (slot_date, start_time, end_time),
      pre_consultations ( status )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return mapAppointmentRows(data ?? []);
}

export type AppointmentTabType = 'upcoming' | 'past' | 'cancelled';

const TAB_STATUS_MAP: Record<AppointmentTabType, string[]> = {
  upcoming: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
  past: ['COMPLETED'],
  cancelled: ['CANCELLED', 'NO_SHOW'],
};

export interface PaginatedAppointments {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchMyAppointmentsPaginated(
  tab: AppointmentTabType,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedAppointments> {
  const statuses = TAB_STATUS_MAP[tab];
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Get total count
  const { count, error: countError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .in('status', statuses);

  if (countError) throw new Error(countError.message);

  // Get paginated data
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, patient_id, profile_id, specialty_id, slot_id, status,
      note, qr_token, qr_expires_at, reminder_at, cancelled_at, created_at,
      specialties (name),
      appointment_slots (slot_date, start_time, end_time),
      pre_consultations ( status )
    `)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const total = count ?? 0;

  return {
    data: mapAppointmentRows(data ?? []),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function mapAppointmentRows(rows: Record<string, unknown>[]): Appointment[] {
  return rows.map((row) => {
    const spec = row.specialties as { name: string } | null;
    const slot = row.appointment_slots as {
      slot_date: string;
      start_time: string;
      end_time: string;
    } | null;
    const pcRaw = row.pre_consultations as { status: string } | { status: string }[] | null;
    const pc = Array.isArray(pcRaw) ? pcRaw[0] : pcRaw;

    return {
      id:            String(row.id),
      patient_id:    String(row.patient_id),
      profile_id:    String(row.profile_id),
      specialty_id:  String(row.specialty_id),
      slot_id:       String(row.slot_id),
      status:        row.status as Appointment['status'],
      note:          row.note != null ? String(row.note) : null,
      qr_token:      String(row.qr_token),
      qr_expires_at: String(row.qr_expires_at),
      reminder_at:   String(row.reminder_at),
      cancelled_at:  row.cancelled_at != null ? String(row.cancelled_at) : null,
      created_at:    String(row.created_at),
      specialty_name: spec?.name ?? '—',
      slot_date:     slot?.slot_date ?? '',
      start_time:    slot?.start_time ?? '',
      end_time:      slot?.end_time ?? '',
      pre_consult_status: !pc
        ? 'none'
        : pc.status === 'SUBMITTED'
          ? 'submitted'
          : 'draft',
    } satisfies Appointment;
  });
}

export async function fetchPatientProfile(userId: string) {
  const { data, error } = await supabase
    .from('patient')
    .select('id, legal_first_name, legal_last_name, submitted_at, status')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data as {
    id: string;
    legal_first_name: string | null;
    legal_last_name: string | null;
    submitted_at: string | null;
    status: string | null;
  };
}

export const BOOKING_BLOCKED_MESSAGE =
  'Hồ sơ của bạn đang chờ xác minh, vui lòng chờ...';

export function canPatientSelfBook(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

export function bookingBlockedMessage(): string {
  return BOOKING_BLOCKED_MESSAGE;
}

/** Maps Supabase RPC error codes to user-facing messages */
export function mapBookingError(message: string): string {
  if (message.includes('SLOT_UNAVAILABLE'))
    return 'Giờ khám vừa được đặt, vui lòng chọn giờ khám khác.';
  if (message.includes('DUPLICATE_SESSION'))
    return 'Bạn đã có lịch trong buổi này (sáng/chiều). Vui lòng chọn buổi khác.';
  if (message.includes('PROFILE_UNVERIFIED'))
    return bookingBlockedMessage();
  if (message.includes('PROFILE_NOT_FOUND'))
    return 'Không tìm thấy hồ sơ bệnh nhân.';
  if (message.includes('SLOT_IN_PAST'))
    return 'Không thể đặt lịch cho slot đã qua.';
  if (message.includes('TOO_LATE_TO_CANCEL'))
    return 'Vui lòng gọi hotline để hủy lịch sát giờ (dưới 2 tiếng trước giờ khám).';
  if (message.includes('CANNOT_CANCEL'))
    return 'Lịch hẹn này không thể hủy.';
  return message;
}
