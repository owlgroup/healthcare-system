export type AdminAppointmentStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AdminAppointment {
  id: string;
  patient_id: string;
  profile_id: string;
  specialty_id: string;
  slot_id: string | null;
  status: AdminAppointmentStatus;
  note: string | null;
  walk_in: boolean;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  specialty_name: string | null;
  specialty_icon: string | null;
  slot_date: string | null;
  start_time: string | null;
  end_time: string | null;
  doctor_id: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  patient_dob: string | null;
  doctor_name: string | null;
  // FR-022: Pre-consultation indicators
  pre_consult_status: 'none' | 'draft' | 'submitted';
  pre_consult_doctor_exists: boolean;
  pre_consult_drug_allergy: boolean;
  pre_consult_severe_pain: boolean;
  has_vital_signs: boolean;
}

export interface PatientSearchResult {
  profile_id: string;
  patient_id: string;
  patient_name: string;
  phone_number: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  submitted_at: string | null;
}

export interface AdminAppointmentFilters {
  date?: string;       // YYYY-MM-DD — single day (today mode)
  date_from?: string;  // YYYY-MM-DD — range start (week/month mode)
  date_to?: string;    // YYYY-MM-DD — range end   (week/month mode)
  specialty_id?: string;
  status?: AdminAppointmentStatus | '';
  doctor_id?: string;
  search?: string;
}

export type AdminAppointmentsListParams = {
  search?: string;
  page?: number;
  limit?: number;
  status?: AdminAppointmentStatus | string;
  dateFrom?: string;
  dateTo?: string;
  specialtyId?: string;
  doctorId?: string;
};

export type AdminAppointmentsListResult = {
  rows: AdminAppointment[];
  total: number;
  error: Error | null;
};

export const ADMIN_STATUS_LABEL: Record<AdminAppointmentStatus, string> = {
  CONFIRMED:  'Chờ khám',
  CHECKED_IN: 'Đã tiếp nhận',
  IN_PROGRESS:'Đang khám',
  COMPLETED:  'Hoàn thành',
  CANCELLED:  'Đã hủy',
  NO_SHOW:    'Không đến',
};

export const ADMIN_STATUS_COLOR: Record<AdminAppointmentStatus, string> = {
  CONFIRMED:  'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  IN_PROGRESS:'bg-purple-100 text-purple-700',
  COMPLETED:  'bg-gray-100 text-gray-600',
  CANCELLED:  'bg-red-100 text-red-600',
  NO_SHOW:    'bg-orange-100 text-orange-600',
};

export const ADMIN_STATUS_DOT: Record<AdminAppointmentStatus, string> = {
  CONFIRMED:  'bg-blue-500',
  CHECKED_IN: 'bg-green-500',
  IN_PROGRESS:'bg-purple-500',
  COMPLETED:  'bg-gray-400',
  CANCELLED:  'bg-red-500',
  NO_SHOW:    'bg-orange-500',
};

export const WALK_IN_LABEL = 'Khám không hẹn';
