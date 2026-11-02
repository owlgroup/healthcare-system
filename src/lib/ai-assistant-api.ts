import { supabase } from './supabase';
import {
  generateSoapBundleFromTranscript,
  transcriptToPlainText,
  type NlpAnalyzeResult,
} from './stt-nlp-api';

export type VoiceSession = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  audio_url: string | null;
  audio_storage_path: string | null;
  transcript_raw: Array<{ speaker: 'doctor' | 'patient'; text: string; start_time?: string; end_time?: string }>;
  transcript_edited: Array<{ speaker: 'doctor' | 'patient'; text: string; start_time?: string; end_time?: string }> | null;
  created_at: string;
};

export function resolveTranscriptTurns(
  edited: VoiceSession['transcript_edited'],
  raw: VoiceSession['transcript_raw'] | null | undefined
): VoiceSession['transcript_raw'] {
  return Array.isArray(edited) ? edited : (raw ?? []);
}

export async function persistTranscriptLines(
  appointmentId: string,
  lines: VoiceSession['transcript_raw']
): Promise<void> {
  const { error } = await supabase
    .from('voice_sessions')
    .update({ transcript_edited: lines, transcript_raw: lines })
    .eq('appointment_id', appointmentId);

  if (error) throw new Error(error.message);
}

export type ConsultationRecording = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  audio_storage_path: string;
  duration_seconds: number | null;
  transcript_snapshot: VoiceSession['transcript_raw'];
  created_at: string;
};

export type RiskAssessment = {
  id: string;
  exam_id: string;
  appointment_id: string;
  patient_id: string;
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  risk_factors: Array<{ factor: string; contribution_pct: number }>;
  recommendation: string;
  model_version: string;
  override_applied: boolean;
  calculated_at: string;
};

export type ClinicalTask = {
  id: string;
  appointment_id: string | null;
  patient_id: string | null;
  assigned_role: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  due_date: string;
  override_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  patient?: {
    legal_first_name: string;
    legal_last_name: string;
    phone_number: string;
  };
};

const AUDIO_BUCKET = 'consultation-audios';
/** Playback links — refreshed on demand via storage path. */
const PRESIGNED_TTL_SEC = 3600;

async function uploadConsultationAudio(
  appointmentId: string,
  audioBlob: Blob
): Promise<{ storagePath: string; signedUrl: string }> {
  const ext = audioBlob.type.includes('webm') ? 'webm' : 'wav';
  const storagePath = `${appointmentId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(storagePath, audioBlob, {
      upsert: true,
      contentType: audioBlob.type || 'audio/webm',
      cacheControl: '3600',
    });

  if (uploadErr) throw new Error(`Không thể lưu file âm thanh: ${uploadErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, PRESIGNED_TTL_SEC);

  if (signErr || !signed?.signedUrl) {
    throw new Error('Không thể tạo liên kết truy cập âm thanh.');
  }

  return { storagePath, signedUrl: signed.signedUrl };
}

export async function getConsultationAudioUrl(
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, PRESIGNED_TTL_SEC);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function saveVoiceSession(
  appointmentId: string,
  transcript: VoiceSession['transcript_raw'],
  audioBlob?: Blob,
  transcriptEdited?: VoiceSession['transcript_edited'],
  options?: { durationSeconds?: number }
): Promise<{ audioUrl: string | null; storagePath: string | null; recordingId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');

  let audioUrl: string | null = null;
  let storagePath: string | null = null;
  let recordingId: string | null = null;

  if (audioBlob) {
    const uploaded = await uploadConsultationAudio(appointmentId, audioBlob);
    audioUrl = uploaded.signedUrl;
    storagePath = uploaded.storagePath;

    const { data: recordingRow, error: recordingErr } = await supabase
      .from('consultation_recordings')
      .insert({
        appointment_id: appointmentId,
        doctor_id: user.id,
        audio_storage_path: storagePath,
        duration_seconds: options?.durationSeconds ?? null,
        transcript_snapshot: transcript,
      })
      .select('id')
      .single();

    if (recordingErr) throw new Error(recordingErr.message);
    recordingId = recordingRow?.id ? String(recordingRow.id) : null;
  }

  const { error } = await supabase
    .from('voice_sessions')
    .upsert({
      appointment_id: appointmentId,
      doctor_id: user.id,
      audio_url: audioUrl,
      audio_storage_path: storagePath,
      transcript_raw: transcript,
      transcript_edited: transcriptEdited ?? null,
    }, { onConflict: 'appointment_id' });

  if (error) throw new Error(error.message);

  return { audioUrl, storagePath, recordingId };
}

export async function listConsultationRecordings(
  appointmentId: string
): Promise<ConsultationRecording[]> {
  const { data, error } = await supabase
    .from('consultation_recordings')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultationRecording[];
}

export async function updateTranscriptEdited(
  appointmentId: string,
  transcriptEdited: VoiceSession['transcript_edited']
): Promise<void> {
  const { error } = await supabase
    .from('voice_sessions')
    .update({ transcript_edited: transcriptEdited })
    .eq('appointment_id', appointmentId);

  if (error) throw new Error(error.message);
}

export async function persistRegeneratedTranscript(params: {
  appointmentId: string;
  fullTranscript: VoiceSession['transcript_raw'];
  recordingId: string;
  newTurns: VoiceSession['transcript_raw'];
}): Promise<void> {
  const { error: sessionError } = await supabase
    .from('voice_sessions')
    .update({ transcript_raw: params.fullTranscript, transcript_edited: params.fullTranscript })
    .eq('appointment_id', params.appointmentId);

  if (sessionError) throw new Error(sessionError.message);

  const { error: recordingError } = await supabase
    .from('consultation_recordings')
    .update({ transcript_snapshot: params.newTurns })
    .eq('id', params.recordingId);

  if (recordingError) throw new Error(recordingError.message);
}

export async function getVoiceSession(appointmentId: string): Promise<VoiceSession | null> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as VoiceSession | null;
}

export type GenerateSoapFromAiResult = {
  s_text: string;
  o_text: string;
  a_text: string;
  p_text: string;
  icd_codes: Array<{ code: string; name: string; confidence: number; reason: string }>;
  analysis?: NlpAnalyzeResult;
};

export async function generateSoapFromAi(
  appointmentId: string,
  transcriptOverride?: VoiceSession['transcript_raw']
): Promise<GenerateSoapFromAiResult> {
  const voice = transcriptOverride
    ? { transcript_raw: transcriptOverride, transcript_edited: null }
    : await getVoiceSession(appointmentId).catch(() => null);

  const turns = resolveTranscriptTurns(voice?.transcript_edited ?? null, voice?.transcript_raw);

  const transcriptText = turns.length ? transcriptToPlainText(turns) : '';

  if (!transcriptText.trim()) {
    throw new Error('Chưa có transcript phiên khám. Vui lòng ghi âm hoặc nhập nội dung trước.');
  }

  const bundle = await generateSoapBundleFromTranscript(transcriptText);

  return {
    ...bundle.fields,
    icd_codes: bundle.icdCodes,
    analysis: bundle.analysis,
  };
}

export async function getRiskAssessment(examId: string): Promise<RiskAssessment | null> {
  const { data, error } = await supabase
    .from('risk_assessments')
    .select('*')
    .eq('exam_id', examId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RiskAssessment | null;
}

export async function recalculateRiskScore(examId: string): Promise<RiskAssessment | null> {
  const { error } = await supabase.rpc('calculate_risk_score', { p_exam_id: examId });
  if (error) throw new Error(error.message);
  return getRiskAssessment(examId);
}

export async function fetchClinicalTasks(_portal: 'doctor' | 'admin'): Promise<ClinicalTask[]> {
  const { data, error } = await supabase
    .from('clinical_tasks')
    .select(`
      *,
      patient:patient_id (
        legal_first_name,
        legal_last_name,
        phone_number
      )
    `)
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    patient: Array.isArray(row.patient) ? row.patient[0] : row.patient || undefined,
  })) as ClinicalTask[];
}

export async function updateClinicalTask(
  taskId: string,
  status: ClinicalTask['status'],
  overrideReason?: string
): Promise<void> {
  const { error } = await supabase
    .from('clinical_tasks')
    .update({
      status,
      override_reason: overrideReason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(error.message);
}
