// FR-021: Check-in & AI Routing — API layer
// All functions call Supabase RPCs or direct table queries.

import { supabase } from '@/lib/supabase';
import type {
  CallNextResult,
  CheckinResult,
  QueueEntry,
  ServiceType,
} from '@/types/queue';

// ─── Patient: QR self-service check-in ───────────────────────────────────────

export async function performCheckin(appointmentId: string): Promise<CheckinResult> {
  const { data, error } = await supabase.rpc('perform_checkin', {
    p_appointment_id: appointmentId,
    p_walk_in:        false,
    p_service_type:   'GENERAL',
  });

  if (error) throw new Error(error.message);

  const result = data as {
    queue_entry_id: string;
    token_full: string;
    room_name: string | null;
    doctor_name: string | null;
    estimated_wait: number | null;
    position: number;
  };

  return {
    queue_entry_id: result.queue_entry_id,
    token_full:     result.token_full,
    room_name:      result.room_name,
    doctor_name:    result.doctor_name,
    estimated_wait: result.estimated_wait,
    position:       result.position ?? 0,
  };
}

// ─── Receptionist: walk-in check-in ──────────────────────────────────────────

export async function performWalkinCheckin(
  appointmentId: string,
  serviceType: ServiceType,
): Promise<CheckinResult> {
  const { data, error } = await supabase.rpc('perform_checkin', {
    p_appointment_id: appointmentId,
    p_walk_in:        true,
    p_service_type:   serviceType,
  });

  if (error) throw new Error(error.message);

  const result = data as {
    queue_entry_id: string;
    token_full: string;
    room_name: string | null;
    doctor_name: string | null;
    estimated_wait: number | null;
    position: number;
  };

  return {
    queue_entry_id: result.queue_entry_id,
    token_full:     result.token_full,
    room_name:      result.room_name,
    doctor_name:    result.doctor_name,
    estimated_wait: result.estimated_wait,
    position:       result.position ?? 0,
  };
}

// ─── Fetch queue entries ──────────────────────────────────────────────────────

type QueueRow = Record<string, unknown>;

function mapQueueRow(row: QueueRow): QueueEntry {
  const rooms = row.rooms as { name: string } | null;
  const spec  = row.specialties as { name: string } | null;

  return {
    id:             String(row.id),
    appointment_id: String(row.appointment_id),
    patient_id:     String(row.patient_id),
    profile_id:     String(row.profile_id),
    room_id:        row.room_id != null ? String(row.room_id) : null,
    room_name:      rooms?.name ?? null,
    doctor_id:      row.doctor_id != null ? String(row.doctor_id) : null,
    doctor_name:    null, // enriched separately if needed
    specialty_id:   row.specialty_id != null ? String(row.specialty_id) : null,
    specialty_name: spec?.name ?? null,
    service_type:   String(row.service_type) as QueueEntry['service_type'],
    token_prefix:   String(row.token_prefix) as QueueEntry['token_prefix'],
    token_number:   Number(row.token_number),
    token_full:     String(row.token_full),
    status:         String(row.status) as QueueEntry['status'],
    position:       Number(row.position),
    walk_in:        Boolean(row.walk_in),
    estimated_wait: row.estimated_wait != null ? Number(row.estimated_wait) : null,
    checked_in_at:  String(row.checked_in_at),
    called_at:      row.called_at != null ? String(row.called_at) : null,
    in_room_at:     row.in_room_at != null ? String(row.in_room_at) : null,
    done_at:        row.done_at != null ? String(row.done_at) : null,
    created_at:     String(row.created_at),
    patient_name:   row.patient_name != null ? String(row.patient_name) : null,
    patient_phone:  row.patient_phone != null ? String(row.patient_phone) : null,
  };
}

const QUEUE_SELECT = `
  id, appointment_id, patient_id, profile_id,
  room_id, doctor_id, specialty_id,
  service_type, token_prefix, token_number, token_full,
  status, position, walk_in, estimated_wait,
  checked_in_at, called_at, in_room_at, done_at, created_at,
  rooms (name),
  specialties (name)
`;

/** Fetch all active queue entries for a given date (admin/display board). */
export async function fetchAllQueueEntries(date?: string): Promise<QueueEntry[]> {
  let query = supabase
    .from('queue_entries')
    .select(QUEUE_SELECT)
    .in('status', ['WAITING', 'CALLED', 'IN_ROOM'])
    .order('position', { ascending: true })
    .order('checked_in_at', { ascending: true });

  if (date) {
    query = query.gte('checked_in_at', `${date}T00:00:00`)
                 .lte('checked_in_at', `${date}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as QueueRow[]).map(mapQueueRow);
}

/** Fetch active queue entries for a specific room (doctor dashboard). */
export async function fetchRoomQueue(roomId: string): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from('queue_entries')
    .select(QUEUE_SELECT)
    .eq('room_id', roomId)
    .in('status', ['WAITING', 'CALLED', 'IN_ROOM'])
    .order('position', { ascending: true })
    .order('checked_in_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as QueueRow[]).map(mapQueueRow);
}

/** Fetch active queue entries assigned to a specific doctor. */
export async function fetchDoctorQueue(doctorId: string): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from('queue_entries')
    .select(QUEUE_SELECT)
    .eq('doctor_id', doctorId)
    .in('status', ['WAITING', 'CALLED', 'IN_ROOM'])
    .order('position', { ascending: true })
    .order('checked_in_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as QueueRow[]).map(mapQueueRow);
}

// ─── Doctor: complete current + call next ─────────────────────────────────────

export async function callNextPatient(
  doctorId: string,
  roomId: string,
): Promise<CallNextResult> {
  const { data, error } = await supabase.rpc('call_next_patient', {
    p_doctor_id: doctorId,
    p_room_id:   roomId,
  });

  if (error) throw new Error(error.message);
  return data as CallNextResult;
}

// ─── Admin: manual room reassignment ─────────────────────────────────────────

export async function reassignRoom(
  queueEntryId: string,
  newRoomId: string,
): Promise<void> {
  const { error } = await supabase
    .from('queue_entries')
    .update({ room_id: newRoomId })
    .eq('id', queueEntryId)
    .in('status', ['WAITING', 'CALLED']);

  if (error) throw new Error(error.message);
}
