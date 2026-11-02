export type Specialty = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  specialty_id: string | null;
  specialty_name?: string;
  price_vnd: number | null;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
};

export type Facility = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  facility_id: string;
  facility_name?: string;
  name: string;
  room_number: string | null;
  capacity: number;
  equipment: string | null;
  is_active: boolean;
  created_at: string;
};

export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  specialty_id: string;
  specialty_name?: string;
  facility_id: string;
  facility_name?: string;
  room_id: string | null;
  room_name?: string;
  work_days: number[];           // 0=Sun … 6=Sat
  work_start_time: string;       // HH:MM:SS
  work_end_time: string;
  slot_duration_minutes: number;
  exceptions: string[];          // YYYY-MM-DD
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

export type QuestionCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DEACTIVATE';
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

export type Doctor = {
  user_id: string;
  full_name: string | null;
  email: string;
  specialty: string | null;
};

export type MasterDataListParams = {
  search?: string;
  page?: number;
  limit?: number;
  status?: 'all' | 'active' | 'inactive';
};

export type MasterDataListResult<T> = {
  rows: T[];
  total: number;
};

export type AuditLogListParams = {
  search?: string;
  page?: number;
  limit?: number;
  tableName?: string;
};

export const DOW_LABELS: Record<number, string> = {
  0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7',
};

export const DOW_FULL: Record<number, string> = {
  0: 'Chủ nhật', 1: 'Thứ hai', 2: 'Thứ ba', 3: 'Thứ tư',
  4: 'Thứ năm', 5: 'Thứ sáu', 6: 'Thứ bảy',
};

export function formatWorkDays(days: number[]): string {
  return days.sort((a, b) => a - b).map((d) => DOW_LABELS[d] ?? d).join(', ');
}

export function formatTime(t: string): string {
  return t.slice(0, 5);
}

export function formatVND(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}
