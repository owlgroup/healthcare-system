/**
 * Healthcare STT — Module 5/6 Backend client
 * Swagger: https://healthcare.187-127-103-1.nip.io/docs
 */

const DEFAULT_BASE_URL = 'https://healthcare.187-127-103-1.nip.io';

export function getSttApiBaseUrl(): string {
  const raw = import.meta.env.VITE_STT_API_URL;
  return (raw?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export type TranscriptTurn = {
  speaker: 'doctor' | 'patient';
  text: string;
};

export type NlpEvidenceItem = {
  text: string;
  evidence?: string;
};

export type NlpAnalyzeResult = {
  complaints: NlpEvidenceItem[];
  symptoms_present: NlpEvidenceItem[];
  symptoms_denied: NlpEvidenceItem[];
  medications_mentioned: NlpEvidenceItem[];
  red_flags: NlpEvidenceItem[];
};

export type NlpSoapResult = {
  subjective: {
    chief_complaint?: string;
    hpi?: string;
    medications_mentioned?: string[];
    allergies?: string;
  };
  objective: {
    vitals?: string;
    physical_exam?: string;
  };
  assessment: {
    clinical_impression?: string;
    icd10_suggested?: string[];
  };
  plan: {
    investigations?: string[];
    medications?: string[];
    follow_up?: string;
  };
  disclaimer?: string;
};

export type Icd10Suggestion = {
  code: string;
  name_vi: string;
  name_en?: string;
  confidence: number;
  evidence?: string;
  caution?: string;
};

type ApiTurn = { role?: string; speaker?: string; text: string };

async function sttFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getSttApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d: { msg?: string }) => d.msg ?? '').join('; ');
      } else if (typeof body.detail === 'string') {
        detail = body.detail;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(`STT API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function transcriptToPlainText(turns: TranscriptTurn[]): string {
  return turns.map((t) => t.text).join('\n');
}

export function mapApiTurnsToTranscript(turns: ApiTurn[]): TranscriptTurn[] {
  return turns.map((turn) => ({
    speaker: turn.role === 'patient' || turn.speaker === 'patient' ? 'patient' : 'doctor',
    text: turn.text.trim(),
  })).filter((t) => t.text.length > 0);
}

function extractStringList(items: NlpEvidenceItem[] | string[] | undefined): string[] {
  if (!items?.length) return [];
  return items.map((item) => (typeof item === 'string' ? item : item.text)).filter(Boolean);
}

export function formatSoapFields(soap: NlpSoapResult): {
  s_text: string;
  o_text: string;
  a_text: string;
  p_text: string;
} {
  const sParts = [
    soap.subjective?.chief_complaint && `Lý do khám: ${soap.subjective.chief_complaint}`,
    soap.subjective?.hpi,
    soap.subjective?.medications_mentioned?.length
      ? `Thuốc đang dùng: ${soap.subjective.medications_mentioned.join(', ')}`
      : null,
    soap.subjective?.allergies && soap.subjective.allergies !== 'Chưa ghi nhận'
      ? `Dị ứng: ${soap.subjective.allergies}`
      : null,
  ].filter(Boolean);

  const oParts = [
    soap.objective?.vitals,
    soap.objective?.physical_exam && soap.objective.physical_exam !== 'Chưa ghi nhận trong transcript'
      ? soap.objective.physical_exam
      : null,
  ].filter(Boolean);

  const aParts = [
    soap.assessment?.clinical_impression,
    soap.assessment?.icd10_suggested?.length
      ? `Gợi ý ICD-10: ${soap.assessment.icd10_suggested.join('; ')}`
      : null,
  ].filter(Boolean);

  const pParts = [
    soap.plan?.investigations?.length
      ? `Cận lâm sàng: ${soap.plan.investigations.join('; ')}`
      : null,
    soap.plan?.medications?.length
      ? `Thuốc: ${soap.plan.medications.join('; ')}`
      : null,
    soap.plan?.follow_up && soap.plan.follow_up !== 'Chưa ghi nhận'
      ? `Tái khám: ${soap.plan.follow_up}`
      : null,
  ].filter(Boolean);

  return {
    s_text: sParts.join('\n\n'),
    o_text: oParts.join('\n\n'),
    a_text: aParts.join('\n\n'),
    p_text: pParts.join('\n\n'),
  };
}

export async function checkSttApiHealth(): Promise<boolean> {
  try {
    await sttFetch('/health');
    return true;
  } catch {
    return false;
  }
}

export async function createSttSession(params: {
  appointmentId: string;
  doctorId: string;
  consentConfirmed: boolean;
}): Promise<{ session_id: string; ws_url: string }> {
  return sttFetch('/stt/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointment_id: params.appointmentId,
      doctor_id: params.doctorId,
      consent_confirmed: params.consentConfirmed,
    }),
  });
}

export async function transcribeAudio(
  audioBlob: Blob,
  options?: { diarize?: boolean; mode?: 'auto' | 'sync' | 'batch' }
): Promise<{ transcript: string; turns: ApiTurn[] }> {
  const form = new FormData();
  const ext = audioBlob.type.includes('webm') ? 'webm' : 'wav';
  form.append('file', audioBlob, `recording.${ext}`);

  const params = new URLSearchParams();
  params.set('diarize', String(options?.diarize ?? true));
  params.set('mode', options?.mode ?? 'auto');

  return sttFetch(`/stt/transcribe?${params.toString()}`, {
    method: 'POST',
    body: form,
  });
}

export async function diarizeTranscript(transcript: string): Promise<TranscriptTurn[]> {
  const data = await sttFetch<{ turns: ApiTurn[] }>('/stt/diarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  return mapApiTurnsToTranscript(data.turns ?? []);
}

export async function analyzeTranscript(transcript: string): Promise<NlpAnalyzeResult> {
  return sttFetch('/nlp/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
}

export async function generateSoapNote(params: {
  transcript: string;
  chiefComplaints?: string[];
  symptomsPresent?: string[];
  symptomsDenied?: string[];
  medications?: string[];
  icd10Suggested?: string[];
}): Promise<NlpSoapResult> {
  return sttFetch('/nlp/soap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: params.transcript,
      chief_complaints: params.chiefComplaints ?? [],
      symptoms_present: params.symptomsPresent ?? [],
      symptoms_denied: params.symptomsDenied ?? [],
      medications: params.medications ?? [],
      icd10_suggested: params.icd10Suggested ?? [],
    }),
  });
}

export async function suggestIcd10(params: {
  complaints?: string[];
  symptomsPresent?: string[];
  symptomsDenied?: string[];
  recentTranscript?: string;
}): Promise<{ icd10: Icd10Suggestion[]; summary?: string }> {
  return sttFetch('/icd10/rag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      complaints: params.complaints ?? [],
      symptoms_present: params.symptomsPresent ?? [],
      symptoms_denied: params.symptomsDenied ?? [],
      recent_transcript: params.recentTranscript ?? '',
    }),
  });
}

export type SttRegenApis = {
  transcribe: boolean;
  diarize: boolean;
  session: boolean;
};

export type RegenerateTranscriptResult = {
  turns: TranscriptTurn[];
  plainTranscript: string;
  sessionWarning?: string;
};

function turnsFromPlainTranscript(plain: string): TranscriptTurn[] {
  const text = plain.trim();
  return text ? [{ speaker: 'doctor', text }] : [];
}

export async function regenerateTranscriptFromAudio(params: {
  audioBlob?: Blob | null;
  existingTranscript?: string;
  existingTurns?: TranscriptTurn[];
  apis: SttRegenApis;
  session?: { appointmentId: string; doctorId: string };
}): Promise<RegenerateTranscriptResult> {
  const { apis } = params;
  if (!apis.transcribe && !apis.diarize) {
    throw new Error('Chọn ít nhất Transcribe hoặc Diarize để gen lại transcript.');
  }

  let sessionWarning: string | undefined;
  if (apis.session && params.session) {
    try {
      await createSttSession({
        appointmentId: params.session.appointmentId,
        doctorId: params.session.doctorId,
        consentConfirmed: true,
      });
    } catch (err) {
      sessionWarning = (err as Error).message || 'Không tạo được phiên STT. Tiếp tục gen transcript.';
    }
  }

  let turns: TranscriptTurn[] = [];
  let plainTranscript = '';

  if (apis.transcribe) {
    if (!params.audioBlob || params.audioBlob.size === 0) {
      throw new Error('Không có file ghi âm để transcribe.');
    }
    const transcribed = await transcribeAudio(params.audioBlob, {
      diarize: apis.diarize,
      mode: 'auto',
    });
    plainTranscript = transcribed.transcript?.trim() ?? '';
    if (transcribed.turns?.length) {
      turns = mapApiTurnsToTranscript(transcribed.turns);
    } else if (apis.diarize && plainTranscript) {
      turns = await diarizeTranscript(plainTranscript);
    } else {
      turns = turnsFromPlainTranscript(plainTranscript);
    }
  } else if (apis.diarize) {
    const source =
      params.existingTranscript?.trim()
      || transcriptToPlainText(params.existingTurns ?? []);
    if (!source) {
      throw new Error('Không có transcript để diarize. Hãy bật Transcribe hoặc chọn bản ghi đã có chữ.');
    }
    turns = await diarizeTranscript(source);
    plainTranscript = source;
  }

  if (turns.length === 0) {
    throw new Error('Không nhận diện được nội dung hội thoại từ bản ghi.');
  }

  return {
    turns,
    plainTranscript: plainTranscript || transcriptToPlainText(turns),
    sessionWarning,
  };
}

export async function buildTranscriptFromAudio(audioBlob: Blob): Promise<{
  turns: TranscriptTurn[];
  plainTranscript: string;
}> {
  const transcribed = await transcribeAudio(audioBlob, { diarize: true, mode: 'auto' });

  let turns: TranscriptTurn[] = [];
  if (transcribed.turns?.length) {
    turns = mapApiTurnsToTranscript(transcribed.turns);
  } else if (transcribed.transcript?.trim()) {
    turns = await diarizeTranscript(transcribed.transcript);
  }

  return {
    turns,
    plainTranscript: transcribed.transcript || transcriptToPlainText(turns),
  };
}

/** Incremental live STT while recording — sync mode for low latency on short clips. */
export async function buildLiveTranscriptFromSnapshot(audioBlob: Blob): Promise<{
  turns: TranscriptTurn[];
  plainTranscript: string;
}> {
  const mode = audioBlob.size > 900_000 ? 'auto' : 'sync';
  const transcribed = await transcribeAudio(audioBlob, { diarize: true, mode });

  let turns: TranscriptTurn[] = [];
  if (transcribed.turns?.length) {
    turns = mapApiTurnsToTranscript(transcribed.turns);
  } else if (transcribed.transcript?.trim()) {
    turns = await diarizeTranscript(transcribed.transcript);
  }

  return {
    turns,
    plainTranscript: transcribed.transcript || transcriptToPlainText(turns),
  };
}

export async function generateSoapBundleFromTranscript(transcript: string): Promise<{
  soap: NlpSoapResult;
  fields: ReturnType<typeof formatSoapFields>;
  analysis: NlpAnalyzeResult;
  icdCodes: Array<{ code: string; name: string; confidence: number; reason: string }>;
}> {
  const analysis = await analyzeTranscript(transcript);

  const complaints = extractStringList(analysis.complaints);
  const symptomsPresent = extractStringList(analysis.symptoms_present);
  const symptomsDenied = extractStringList(analysis.symptoms_denied);
  const medications = extractStringList(analysis.medications_mentioned);

  const soap = await generateSoapNote({
    transcript,
    chiefComplaints: complaints,
    symptomsPresent,
    symptomsDenied,
    medications,
  });

  const fields = formatSoapFields(soap);

  const icdResult = await suggestIcd10({
    complaints,
    symptomsPresent,
    symptomsDenied,
    recentTranscript: transcript,
  });

  const icdCodes = (icdResult.icd10 ?? []).slice(0, 5).map((item) => ({
    code: item.code,
    name: item.name_vi || item.name_en || item.code,
    confidence: item.confidence,
    reason: item.evidence ?? icdResult.summary ?? 'Gợi ý từ AI ICD-10',
  }));

  return { soap, fields, analysis, icdCodes };
}
