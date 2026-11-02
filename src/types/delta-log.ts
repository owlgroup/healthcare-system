// ─── Appointments Audit Log ──────────────────────────────────────────────────

export type AppointmentAction =
  | 'CREATE_WALKIN'
  | 'CHECKIN'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'BULK_CANCEL';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentsAuditEntry = {
  id: string;
  appointment_id: string;
  action: AppointmentAction;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
  old_status: AppointmentStatus | null;
  new_status: AppointmentStatus | null;
  notes: string | null;
  specialty_name: string | null;
  patient_name: string | null;
  doctor_name: string | null;
};

export type AppointmentsAuditListParams = {
  search?: string;
  page?: number;
  limit?: number;
  action?: AppointmentAction | '';
};

// ─── System Audit Log ────────────────────────────────────────────────────────

export type SystemEventType =
  | 'PASSWORD_RESET'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_LOCKED'
  | 'ADMIN_PASSWORD_RESET'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'DOB_VERIFY_SUCCESS'
  | 'DOB_VERIFY_FAILED';

export type SystemAuditEntry = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  email: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type SystemAuditListParams = {
  search?: string;
  page?: number;
  limit?: number;
  eventType?: string;
};

// ─── Signature Logs ──────────────────────────────────────────────────────────

export type SignatureTargetType = 'medical_examination' | 'addendum';

export type SignatureLogEntry = {
  id: string;
  target_type: SignatureTargetType;
  target_id: string;
  signed_by: string;
  signed_by_name: string | null;
  data_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
  patient_name: string | null;
  appointment_id: string | null;
  visit_at: string | null;
};

export type SignatureLogListParams = {
  search?: string;
  page?: number;
  limit?: number;
  targetType?: SignatureTargetType | '';
};

// ─── Shared Types ────────────────────────────────────────────────────────────

export type DeltaLogListResult<T> = {
  total: number;
  rows: T[];
};
