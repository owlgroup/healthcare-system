/**
 * Temporary local storage for signed SOAP health records (multi-version timeline).
 * Persists to localStorage until backend patient health-record API is available.
 */

import type { MedicalExamination, SoapIcdCode } from '@/types/emr';

const STORAGE_PREFIX = 'qcare_health_records_';

export type HealthRecordVersion = {
  version: number;
  signed_at: string;
  exam_id: string;
  appointment_id: string;
  patient_id: string;
  s_text: string | null;
  o_text: string | null;
  a_text: string | null;
  p_text: string | null;
  icd_codes: SoapIcdCode[];
};

function storageKey(patientId: string) {
  return `${STORAGE_PREFIX}${patientId}`;
}

function readRaw(patientId: string): HealthRecordVersion[] {
  if (typeof window === 'undefined' || !patientId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HealthRecordVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(patientId: string, versions: HealthRecordVersion[]) {
  if (typeof window === 'undefined' || !patientId) return;
  window.localStorage.setItem(storageKey(patientId), JSON.stringify(versions));
}

export function appendHealthRecordVersion(
  patientId: string,
  exam: MedicalExamination,
): HealthRecordVersion {
  const existing = readRaw(patientId);
  const version = existing.length > 0 ? Math.max(...existing.map((v) => v.version)) + 1 : 1;
  const entry: HealthRecordVersion = {
    version,
    signed_at: new Date().toISOString(),
    exam_id: exam.id,
    appointment_id: exam.appointment_id,
    patient_id: exam.patient_id,
    s_text: exam.s_text,
    o_text: exam.o_text,
    a_text: exam.a_text,
    p_text: exam.p_text,
    icd_codes: exam.icd_codes,
  };
  writeRaw(patientId, [entry, ...existing]);
  window.dispatchEvent(new CustomEvent('qcare:health-records-updated', { detail: { patientId } }));
  return entry;
}

export function listHealthRecordVersions(patientId: string): HealthRecordVersion[] {
  return readRaw(patientId).sort(
    (a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime(),
  );
}

/** Locked SOAP exams from the database, oldest sign = version 1, newest listed first. */
export function examsToHealthRecordVersions(
  exams: MedicalExamination[],
): HealthRecordVersion[] {
  const unique = new Map<string, MedicalExamination>();
  for (const exam of exams) {
    if (exam.status !== 'LOCKED') continue;
    unique.set(exam.id, exam);
  }
  const chronological = [...unique.values()].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  );
  const numbered = chronological.map((exam, index) => ({
    version: index + 1,
    signed_at: exam.updated_at,
    exam_id: exam.id,
    appointment_id: exam.appointment_id,
    patient_id: exam.patient_id,
    s_text: exam.s_text,
    o_text: exam.o_text,
    a_text: exam.a_text,
    p_text: exam.p_text,
    icd_codes: exam.icd_codes,
  }));
  return numbered.reverse();
}

export function versionToExam(version: HealthRecordVersion): MedicalExamination {
  return {
    id: version.exam_id,
    appointment_id: version.appointment_id,
    patient_id: version.patient_id,
    doctor_id: '',
    s_text: version.s_text,
    o_text: version.o_text,
    a_text: version.a_text,
    p_text: version.p_text,
    status: 'LOCKED',
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: version.signed_at,
    updated_at: version.signed_at,
    icd_codes: version.icd_codes,
  };
}
