// FR-021: Check-in & AI Routing — TypeScript types

export type QueueStatus = 'WAITING' | 'CALLED' | 'IN_ROOM' | 'DONE' | 'REMOVED';
export type ServiceType = 'GENERAL' | 'SPECIALIST' | 'EMERGENCY';

export interface QueueEntry {
  id: string;
  appointment_id: string;
  patient_id: string;
  profile_id: string;
  room_id: string | null;
  room_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  specialty_id: string | null;
  specialty_name: string | null;
  service_type: ServiceType;
  token_prefix: 'A' | 'B' | 'C';
  token_number: number;
  token_full: string;         // e.g. "A015"
  status: QueueStatus;
  position: number;
  walk_in: boolean;
  estimated_wait: number | null; // minutes; null = unknown
  checked_in_at: string;         // ISO timestamp
  called_at: string | null;
  in_room_at: string | null;
  done_at: string | null;
  created_at: string;
  // joined fields (present when fetched with joins)
  patient_name: string | null;
  patient_phone: string | null;
}

export interface CheckinResult {
  queue_entry_id: string;
  token_full: string;
  room_name: string | null;
  doctor_name: string | null;
  estimated_wait: number | null;
  position: number;
}

export interface CallNextResult {
  called: boolean;
  queue_entry_id?: string;
  token_full?: string;
  patient_name?: string;
  message?: string;
}

// ─── Display constants ────────────────────────────────────────────────────────

export const SERVICE_TYPE_PREFIX: Record<ServiceType, 'A' | 'B' | 'C'> = {
  GENERAL:    'A',
  SPECIALIST: 'B',
  EMERGENCY:  'C',
};

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  GENERAL:    'Khám tổng quát',
  SPECIALIST: 'Khám chuyên khoa',
  EMERGENCY:  'Cấp cứu',
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  WAITING:  'Đang chờ',
  CALLED:   'Được gọi',
  IN_ROOM:  'Đang khám',
  DONE:     'Hoàn thành',
  REMOVED:  'Đã xóa',
};

export const QUEUE_STATUS_COLOR: Record<QueueStatus, string> = {
  WAITING:  'bg-blue-100 text-blue-700',
  CALLED:   'bg-yellow-100 text-yellow-800',
  IN_ROOM:  'bg-purple-100 text-purple-700',
  DONE:     'bg-green-100 text-green-700',
  REMOVED:  'bg-gray-100 text-gray-500',
};

export const QUEUE_STATUS_DOT: Record<QueueStatus, string> = {
  WAITING:  'bg-blue-500',
  CALLED:   'bg-yellow-500',
  IN_ROOM:  'bg-purple-500',
  DONE:     'bg-green-500',
  REMOVED:  'bg-gray-400',
};

/** Maps Supabase RPC error codes to user-facing Vietnamese messages */
export function mapQueueError(message: string): string {
  if (message.includes('ALREADY_IN_QUEUE'))
    return 'Bạn đã có trong hàng chờ. Vui lòng đến quầy lễ tân nếu cần hỗ trợ.';
  if (message.includes('QR_TOKEN_CONSUMED'))
    return 'Mã QR này đã được sử dụng. Vui lòng đến quầy lễ tân.';
  if (message.includes('QR_TOKEN_EXPIRED'))
    return 'Mã QR đã hết hạn. Vui lòng đến quầy lễ tân.';
  if (message.includes('INVALID_STATUS'))
    return 'Lịch hẹn này không ở trạng thái chờ khám.';
  if (message.includes('APPOINTMENT_NOT_FOUND'))
    return 'Không tìm thấy lịch hẹn.';
  if (message.includes('TOKEN_LIMIT_EXCEEDED'))
    return 'Hệ thống số thứ tự đã đầy hôm nay. Vui lòng liên hệ lễ tân.';
  if (message.includes('UNAUTHORIZED'))
    return 'Vui lòng đăng nhập để thực hiện thao tác này.';
  return 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ lễ tân.';
}
