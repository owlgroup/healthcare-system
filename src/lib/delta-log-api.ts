import { supabase } from '@/lib/supabase';
import {
  toExamActivityLogEntry,
  type DoctorExamActivityLogEntry,
} from '@/lib/exam-activity-log';
import type {
  AppointmentsAuditEntry,
  AppointmentsAuditListParams,
  DeltaLogListResult,
  SignatureLogEntry,
  SignatureLogListParams,
  SystemAuditEntry,
  SystemAuditListParams,
} from '@/types/delta-log';

type RpcListPayload = { total?: number; rows?: unknown[] };

function mapError(msg: string): string {
  if (msg.includes('FORBIDDEN')) return 'Bạn không có quyền truy cập.';
  return msg;
}

// ─── Appointments Audit Log ──────────────────────────────────────────────────

export async function listAppointmentsAuditLog(
  params: AppointmentsAuditListParams = {},
): Promise<DeltaLogListResult<AppointmentsAuditEntry>> {
  const { data, error } = await supabase.rpc('list_appointments_audit_log', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
    p_action: params.action?.trim() || null,
  });
  if (error) throw new Error(mapError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as AppointmentsAuditEntry[],
  };
}

export async function listDoctorAppointmentsAuditLog(
  params: AppointmentsAuditListParams = {},
): Promise<DeltaLogListResult<AppointmentsAuditEntry>> {
  const { data, error } = await supabase.rpc('list_doctor_appointments_audit_log', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
    p_action: params.action?.trim() || null,
  });
  if (error) throw new Error(mapError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as AppointmentsAuditEntry[],
  };
}

export type DoctorExamActivityLogListParams = {
  search?: string;
  page?: number;
  limit?: number;
};

type ExamActivityLogRpcRow = {
  id: string;
  exam_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  created_at: string;
  changed_fields?: unknown;
  related_exam_id?: string | null;
  patient_name: string | null;
  appointment_id: string | null;
};

function mapExamActivityLogPayload(
  payload: RpcListPayload,
): DeltaLogListResult<DoctorExamActivityLogEntry> {
  const rows = (payload.rows ?? []) as ExamActivityLogRpcRow[];
  return {
    total: Number(payload.total ?? 0),
    rows: rows.map((row) => ({
      ...toExamActivityLogEntry(row),
      patient_name: row.patient_name,
      appointment_id: row.appointment_id,
    })),
  };
}

export async function listPatientAppointmentsAuditLog(
  params: AppointmentsAuditListParams = {},
): Promise<DeltaLogListResult<AppointmentsAuditEntry>> {
  const { data, error } = await supabase.rpc('list_patient_appointments_audit_log', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
    p_action: params.action?.trim() || null,
  });
  if (error) throw new Error(mapError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as AppointmentsAuditEntry[],
  };
}

async function listExaminationActivityLogRpc(
  rpcName:
    | 'list_doctor_examination_activity_log'
    | 'list_admin_examination_activity_log'
    | 'list_patient_examination_activity_log',
  params: DoctorExamActivityLogListParams = {},
): Promise<DeltaLogListResult<DoctorExamActivityLogEntry>> {
  const { data, error } = await supabase.rpc(rpcName, {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
  });
  if (error) throw new Error(mapError(error.message));
  return mapExamActivityLogPayload((data ?? { total: 0, rows: [] }) as RpcListPayload);
}

export async function listDoctorExaminationActivityLog(
  params: DoctorExamActivityLogListParams = {},
): Promise<DeltaLogListResult<DoctorExamActivityLogEntry>> {
  return listExaminationActivityLogRpc('list_doctor_examination_activity_log', params);
}

export async function listAdminExaminationActivityLog(
  params: DoctorExamActivityLogListParams = {},
): Promise<DeltaLogListResult<DoctorExamActivityLogEntry>> {
  return listExaminationActivityLogRpc('list_admin_examination_activity_log', params);
}

export async function listPatientExaminationActivityLog(
  params: DoctorExamActivityLogListParams = {},
): Promise<DeltaLogListResult<DoctorExamActivityLogEntry>> {
  return listExaminationActivityLogRpc('list_patient_examination_activity_log', params);
}

// ─── System Audit Log ────────────────────────────────────────────────────────

export async function listSystemAuditLog(
  params: SystemAuditListParams = {},
): Promise<DeltaLogListResult<SystemAuditEntry>> {
  const { data, error } = await supabase.rpc('list_system_audit_log', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
    p_event_type: params.eventType?.trim() || null,
  });
  if (error) throw new Error(mapError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as SystemAuditEntry[],
  };
}

// ─── Signature Logs ──────────────────────────────────────────────────────────

export async function listSignatureLogs(
  params: SignatureLogListParams = {},
): Promise<DeltaLogListResult<SignatureLogEntry>> {
  const { data, error } = await supabase.rpc('list_signature_logs', {
    p_query: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 10,
    p_target_type: params.targetType?.trim() || null,
  });
  if (error) throw new Error(mapError(error.message));
  const payload = (data ?? { total: 0, rows: [] }) as RpcListPayload;
  return {
    total: Number(payload.total ?? 0),
    rows: (payload.rows ?? []) as SignatureLogEntry[],
  };
}
