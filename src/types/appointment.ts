export type AppointmentStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Specialty = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};

export type AppointmentSlot = {
  id: string;
  specialty_id: string;
  slot_date: string;       // YYYY-MM-DD
  start_time: string;      // HH:MM:SS
  end_time: string;
  is_available: boolean;
};

export type PreConsultStatus = 'none' | 'draft' | 'submitted';

export type Appointment = {
  id: string;
  patient_id: string;
  profile_id: string;
  specialty_id: string;
  slot_id: string;
  status: AppointmentStatus;
  note: string | null;
  qr_token: string;
  qr_expires_at: string;
  reminder_at: string;
  cancelled_at: string | null;
  created_at: string;
  // joined
  specialty_name: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  pre_consult_status: PreConsultStatus;
};

export type BookAppointmentParams = {
  profile_id: string;
  specialty_id: string;
  slot_id: string;
  note?: string;
};

/** Determines the session period (morning / afternoon) per RULE-008a */
export function getSession(startTime: string): 'morning' | 'afternoon' {
  const hour = parseInt(startTime.split(':')[0] ?? '0', 10);
  return hour < 12 ? 'morning' : 'afternoon';
}

export function formatSlotTime(time: string): string {
  return time.slice(0, 5); // HH:MM
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED:   'Chờ khám',
  CHECKED_IN:  'Đã tiếp nhận',
  IN_PROGRESS: 'Đang khám',
  COMPLETED:   'Hoàn thành',
  CANCELLED:   'Đã hủy',
  NO_SHOW:     'Không đến',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
  NO_SHOW:     'bg-red-100 text-red-600',
};
