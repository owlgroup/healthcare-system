export type ExamActivityAction = 'UPDATED' | 'AI_GENERATED' | 'SIGNED' | 'ADDENDUM_CREATED';

export type SoapChangedField = 's_text' | 'o_text' | 'a_text' | 'p_text';

const SOAP_FIELDS: SoapChangedField[] = ['s_text', 'o_text', 'a_text', 'p_text'];

export const SOAP_CHANGED_FIELD_CHIPS: Record<SoapChangedField, string> = {
  s_text: 'S',
  o_text: 'O',
  a_text: 'A',
  p_text: 'P',
};

export const EXAM_ACTIVITY_ACTION_LABEL: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'Tạo nháp AI',
  UPDATED: 'Cập nhật hồ sơ',
  SIGNED: 'Ký xác nhận',
  ADDENDUM_CREATED: 'Phiếu bổ sung',
};

const ACTIONS: ExamActivityAction[] = ['UPDATED', 'AI_GENERATED', 'SIGNED', 'ADDENDUM_CREATED'];

export type SoapNoteSnapshot = {
  s_text: string | null;
  o_text: string | null;
  a_text: string | null;
  p_text: string | null;
};

export type ExamActivityLogEntry = {
  id: string;
  exam_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ExamActivityAction;
  created_at: string;
  message: string;
  changed_fields: SoapChangedField[];
  related_exam_id: string | null;
};

export type DoctorExamActivityLogEntry = ExamActivityLogEntry & {
  patient_name: string | null;
  appointment_id: string | null;
};

export type ComprehensiveTimelineEvent = ExamActivityLogEntry & {
  soap: SoapNoteSnapshot | null;
  aiSoap?: SoapNoteSnapshot | null;
  amendment_reason?: string | null;
};

export type ExamAddendumSource = {
  id: string;
  created_at: string;
  soap: SoapNoteSnapshot;
  actor_name?: string | null;
  amendment_reason?: string | null;
};

export type ComprehensiveExamTimelineInput = {
  examId: string;
  actorName?: string | null;
  examCreatedAt: string;
  logs: ExamActivityLogEntry[];
  aiBaseline: SoapNoteSnapshot | null;
  doctorSoap: SoapNoteSnapshot;
  examStatus: 'DRAFT' | 'LOCKED';
  signedAt: string | null;
  addenda: ExamAddendumSource[];
};

function doctorLabel(doctorName: string): string {
  const name = doctorName.trim();
  return name ? `Bác sĩ ${name}` : 'Bác sĩ';
}

export function formatExamActivityMessage(action: ExamActivityAction, doctorName: string): string {
  const doctor = doctorLabel(doctorName);
  switch (action) {
    case 'AI_GENERATED':
      return `${doctor} đã tạo nháp SOAP bằng AI`;
    case 'SIGNED':
      return `${doctor} đã ký xác nhận hồ sơ`;
    case 'ADDENDUM_CREATED':
      return `${doctor} đã tạo phiếu bổ sung`;
    default:
      return `${doctor} đã cập nhật nội dung hồ sơ`;
  }
}

export function formatExamUpdateActivityMessage(doctorName: string): string {
  return formatExamActivityMessage('UPDATED', doctorName);
}

export function diffSoapFormFields(
  previous: Record<SoapChangedField, string>,
  next: Record<SoapChangedField, string>,
): SoapChangedField[] {
  return SOAP_FIELDS.filter(
    (field) => (previous[field] ?? '').trim() !== (next[field] ?? '').trim(),
  );
}

export function normalizeChangedFields(values: unknown): SoapChangedField[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is SoapChangedField =>
    SOAP_FIELDS.includes(value as SoapChangedField),
  );
}

export function normalizeExamActivityAction(value: unknown): ExamActivityAction {
  if (typeof value === 'string' && ACTIONS.includes(value as ExamActivityAction)) {
    return value as ExamActivityAction;
  }
  return 'UPDATED';
}

export function toExamActivityLogEntry(row: {
  id: string;
  exam_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ExamActivityAction | string;
  created_at: string;
  changed_fields?: unknown;
  related_exam_id?: string | null;
}): ExamActivityLogEntry {
  const action = normalizeExamActivityAction(row.action);
  return {
    id: row.id,
    exam_id: row.exam_id,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    action,
    created_at: row.created_at,
    message: formatExamActivityMessage(action, row.actor_name ?? ''),
    changed_fields: normalizeChangedFields(row.changed_fields),
    related_exam_id: row.related_exam_id ?? null,
  };
}

function hasSoapContent(snapshot: SoapNoteSnapshot | null): boolean {
  if (!snapshot) return false;
  return SOAP_FIELDS.some((field) => (snapshot[field] ?? '').trim() !== '');
}

function sortByCreatedAt(events: ComprehensiveTimelineEvent[]): ComprehensiveTimelineEvent[] {
  return [...events].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

function syntheticEntry(params: {
  id: string;
  examId: string;
  action: ExamActivityAction;
  createdAt: string;
  actorName: string | null;
  relatedExamId?: string | null;
}): ExamActivityLogEntry {
  return {
    id: params.id,
    exam_id: params.examId,
    actor_id: null,
    actor_name: params.actorName,
    action: params.action,
    created_at: params.createdAt,
    message: formatExamActivityMessage(params.action, params.actorName ?? ''),
    changed_fields: [],
    related_exam_id: params.relatedExamId ?? null,
  };
}

function attachSoap(
  entry: ExamActivityLogEntry,
  soap: SoapNoteSnapshot | null,
  aiSoap?: SoapNoteSnapshot | null,
  amendmentReason?: string | null,
): ComprehensiveTimelineEvent {
  return {
    ...entry,
    soap,
    aiSoap: aiSoap ?? null,
    amendment_reason: amendmentReason ?? null,
  };
}

export function buildComprehensiveExamTimeline(
  input: ComprehensiveExamTimelineInput,
): ComprehensiveTimelineEvent[] {
  const actorName = input.actorName ?? null;
  const events: ComprehensiveTimelineEvent[] = input.logs.map((entry) => {
    if (entry.action === 'AI_GENERATED') {
      return attachSoap(entry, input.aiBaseline);
    }
    if (entry.action === 'ADDENDUM_CREATED') {
      const addendum = input.addenda.find((row) =>
        row.id === entry.related_exam_id
        || (!entry.related_exam_id && row.id === entry.exam_id),
      ) ?? input.addenda.find((row) => row.created_at === entry.created_at);
      return attachSoap(entry, addendum?.soap ?? null, null, addendum?.amendment_reason);
    }
    if (entry.action === 'SIGNED' || entry.action === 'UPDATED') {
      return attachSoap(entry, input.doctorSoap, input.aiBaseline);
    }
    return attachSoap(entry, null);
  });

  if (hasSoapContent(input.aiBaseline) && !events.some((e) => e.action === 'AI_GENERATED')) {
    events.push(attachSoap(
      syntheticEntry({
        id: `synth-ai-${input.examId}`,
        examId: input.examId,
        action: 'AI_GENERATED',
        createdAt: input.examCreatedAt,
        actorName,
      }),
      input.aiBaseline,
    ));
  }

  if (
    input.examStatus === 'LOCKED'
    && input.signedAt
    && !events.some((e) => e.action === 'SIGNED')
  ) {
    events.push(attachSoap(
      syntheticEntry({
        id: `synth-signed-${input.examId}`,
        examId: input.examId,
        action: 'SIGNED',
        createdAt: input.signedAt,
        actorName,
      }),
      input.doctorSoap,
      input.aiBaseline,
    ));
  }

  for (const addendum of input.addenda) {
    const already = events.some((e) =>
      e.action === 'ADDENDUM_CREATED'
      && (e.related_exam_id === addendum.id || e.id === `synth-addendum-${addendum.id}`),
    );
    if (already) continue;
    events.push(attachSoap(
      syntheticEntry({
        id: `synth-addendum-${addendum.id}`,
        examId: input.examId,
        action: 'ADDENDUM_CREATED',
        createdAt: addendum.created_at,
        actorName: addendum.actor_name ?? actorName,
        relatedExamId: addendum.id,
      }),
      addendum.soap,
      null,
      addendum.amendment_reason,
    ));
  }

  return sortByCreatedAt(events);
}

export function snapshotFromExamFields(fields: {
  s_text?: string | null;
  o_text?: string | null;
  a_text?: string | null;
  p_text?: string | null;
}): SoapNoteSnapshot {
  return {
    s_text: fields.s_text ?? null,
    o_text: fields.o_text ?? null,
    a_text: fields.a_text ?? null,
    p_text: fields.p_text ?? null,
  };
}

export type VersionedActivityEntry = {
  id: string;
  version: number;
  action: ExamActivityAction;
  actor_name: string | null;
  created_at: string;
  changed_fields: SoapChangedField[];
  soap_snapshot: SoapNoteSnapshot | null;
  is_current: boolean;
};

export function computeVersionNumbers<T extends { created_at: string; action: ExamActivityAction }>(
  events: T[]
): (T & { version: number; is_current: boolean })[] {
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return sorted.map((event, index) => ({
    ...event,
    version: index + 1,
    is_current: index === sorted.length - 1,
  }));
}

export function countChangedFields(changedFields: SoapChangedField[]): number {
  return changedFields.length;
}

export function countUnchangedFields(changedFields: SoapChangedField[]): number {
  return SOAP_FIELDS.length - changedFields.length;
}

export const VERSION_ACTION_LABELS: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'Tạo mới',
  UPDATED: 'Chỉnh sửa',
  SIGNED: 'Ký xác nhận',
  ADDENDUM_CREATED: 'Phiếu bổ sung',
};

/** Build newest-first version rows from activity logs (no snapshots). */
export function activityLogsToVersionHistory(
  logs: Array<{
    id: string;
    action: ExamActivityAction;
    actor_name: string | null;
    created_at: string;
    changed_fields: SoapChangedField[];
  }>
): VersionedActivityEntry[] {
  if (logs.length === 0) return [];

  const numbered = computeVersionNumbers(logs);
  return numbered
    .map((entry) => ({
      id: entry.id,
      version: entry.version,
      action: entry.action,
      actor_name: entry.actor_name,
      created_at: entry.created_at,
      changed_fields: entry.changed_fields,
      soap_snapshot: null,
      is_current: entry.is_current,
    }))
    .sort((a, b) => b.version - a.version);
}
