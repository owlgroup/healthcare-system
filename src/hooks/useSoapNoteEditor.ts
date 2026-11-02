/**
 * FR-010: SOAP Note Editor Hook
 * Manages form state, auto-save (30s), AI ICD suggestions, and sign-off
 * Enhanced with: FR-023 Voice-to-Text, FR-024 Auto SOAP, and FR-025 Risk Scoring
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  resolveExaminationId,
  getExaminationByAppointment,
  saveSoapDraft,
  listExaminationActivityLog,
  upsertIcdCode,
  confirmIcdCode,
  rejectIcdCode,
  removeIcdCode,
  signExamination,
  checkDoctorPinSet,
  setDoctorPin,
  getAiIcdSuggestions,
  searchIcd10,
  saveSoapAiBaseline,
  type Icd10SearchResult,
} from '@/lib/emr-api';
import {
  appendHealthRecordVersion,
} from '@/lib/patient-health-records-storage';
import {
  getVoiceSession,
  saveVoiceSession,
  getConsultationAudioUrl,
  listConsultationRecordings,
  type ConsultationRecording,
  updateTranscriptEdited,
  persistRegeneratedTranscript,
  persistTranscriptLines,
  resolveTranscriptTurns,
  generateSoapFromAi,
  getRiskAssessment,
  recalculateRiskScore,
  type RiskAssessment,
  type VoiceSession,
} from '@/lib/ai-assistant-api';
import {
  buildTranscriptFromAudio,
  buildLiveTranscriptFromSnapshot,
  checkSttApiHealth,
  createSttSession,
  regenerateTranscriptFromAudio,
  transcriptToPlainText,
  type NlpAnalyzeResult,
} from '@/lib/stt-nlp-api';
import { SttWebSocketStream } from '@/lib/stt-ws-stream';
import { startPcmCapture, type PcmCaptureHandle } from '@/lib/stt-pcm-capture';
import {
  isAiCircuitOpen,
  recordAiFailure,
  recordAiSuccess,
  getAiCircuitCooldownRemaining,
} from '@/lib/ai-circuit-breaker';
import { getMyDoctorProfile } from '@/lib/doctor-profile-api';
import type { ExamActivityLogEntry } from '@/lib/exam-activity-log';
import { diffSoapFormFields } from '@/lib/exam-activity-log';
import type {
  MedicalExamination,
  SoapFormData,
  SoapIcdCode,
  AiIcdSuggestion,
} from '@/types/emr';
import {
  DEFAULT_SOAP_FORM,
  isPinSignLockMessage,
  validateSoapForSave,
  validateSoapForSign,
} from '@/types/emr';

const AUTO_SAVE_INTERVAL_MS = 30_000; // RULE-010d: 30 seconds
const AI_DEBOUNCE_MS = 2_000;          // RULE-015: 2 second debounce

export type SoapJobStatus = 'idle' | 'streaming' | 'transcribing' | 'analyzing' | 'generating' | 'done' | 'error';

export type UseSoapNoteEditorReturn = {
  // State
  exam: MedicalExamination | null;
  formData: SoapFormData;
  loading: boolean;
  saving: boolean;
  submitting: boolean;
  error: string | null;
  isLocked: boolean;
  autoSavedAt: Date | null;
  hasPinSet: boolean;
  pinLockedUntil: string | null;
  refreshPinLock: () => Promise<void>;

  // ICD suggestions
  aiSuggestions: AiIcdSuggestion[];
  aiLoading: boolean;
  icdSearch: string;
  icdSearchResults: Icd10SearchResult[];
  icdSearchLoading: boolean;

  // Voice recording & transcription (FR-023)
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  recordingConsent: boolean;
  setRecordingConsent: (consent: boolean) => void;
  transcript: VoiceSession['transcript_raw'];
  streamingDraft: { text: string; speaker: 'doctor' | 'patient' } | null;
  isWsStreaming: boolean;
  isLiveTranscribing: boolean;
  nlpAnalysis: NlpAnalyzeResult | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  sttFallbackMode: boolean;
  isEditingTranscript: boolean;
  setIsEditingTranscript: (v: boolean) => void;
  updateTranscriptLine: (index: number, text: string) => void;
  saveTranscriptEdit: () => Promise<void>;
  addManualTranscriptLine: (speaker: 'doctor' | 'patient', text: string) => void;
  removeTranscriptLine: (index: number) => Promise<void>;
  aiCircuitOpen: boolean;
  aiCircuitCooldownMs: number;
  consultationRecordings: Array<ConsultationRecording & { audioUrl?: string | null }>;
  recordingsLoading: boolean;
  resolveRecordingAudioUrl: (storagePath: string) => Promise<string | null>;
  regeneratingRecordingId: string | null;
  regenerateTranscriptFromRecordings: (
    recordings: Array<ConsultationRecording & { audioUrl?: string | null }>
  ) => Promise<void>;

  // AI SOAP Note generation (FR-024)
  isGeneratingSoap: boolean;
  soapJobStatus: SoapJobStatus;
  generateSoap: () => Promise<void>;
  soapSourceBadge: Record<keyof SoapFormData, boolean>;

  // Patient Risk Scoring (FR-025)
  riskAssessment: RiskAssessment | null;
  riskLoading: boolean;
  recalcRisk: () => Promise<void>;

  // Form actions
  updateField: (field: keyof SoapFormData, value: string) => void;
  saveDraft: () => Promise<void>;
  activityLogs: ExamActivityLogEntry[];

  // ICD actions
  addIcdCode: (code: string, name: string, isManual?: boolean) => Promise<void>;
  confirmIcd: (icd: SoapIcdCode) => Promise<void>;
  rejectIcd: (icd: SoapIcdCode) => Promise<void>;
  removeIcd: (icd: SoapIcdCode) => Promise<void>;
  setIcdSearch: (query: string) => void;

  // Sign-off actions
  sign: (params: { pin: string | null; responsibilityAck: boolean }) => Promise<string | null>;
  setupPin: (pin: string) => Promise<boolean>;
};

export function useSoapNoteEditor(appointmentId: string): UseSoapNoteEditorReturn {
  const [exam, setExam] = useState<MedicalExamination | null>(null);
  const [formData, setFormData] = useState<SoapFormData>(DEFAULT_SOAP_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState<string | null>(null);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AiIcdSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // ICD manual search
  const [icdSearch, setIcdSearch] = useState('');
  const [icdSearchResults, setIcdSearchResults] = useState<Icd10SearchResult[]>([]);
  const [icdSearchLoading, setIcdSearchLoading] = useState(false);

  // Voice recording & transcription
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [transcript, setTranscript] = useState<VoiceSession['transcript_raw']>([]);
  const [streamingDraft, setStreamingDraft] = useState<{ text: string; speaker: 'doctor' | 'patient' } | null>(null);
  const [isWsStreaming, setIsWsStreaming] = useState(false);
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [nlpAnalysis, setNlpAnalysis] = useState<NlpAnalyzeResult | null>(null);
  const [sttFallbackMode, setSttFallbackMode] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [aiCircuitOpen, setAiCircuitOpen] = useState(false);
  const [consultationRecordings, setConsultationRecordings] = useState<
    Array<ConsultationRecording & { audioUrl?: string | null }>
  >([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [regeneratingRecordingId, setRegeneratingRecordingId] = useState<string | null>(null);

  // AI SOAP generator states
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [soapJobStatus, setSoapJobStatus] = useState<SoapJobStatus>('idle');
  const [soapSourceBadge, setSoapSourceBadge] = useState<Record<keyof SoapFormData, boolean>>({
    s_text: false,
    o_text: false,
    a_text: false,
    p_text: false,
  });

  // Patient risk score states
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ExamActivityLogEntry[]>([]);

  // Refs for audio capturing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sttSessionIdRef = useRef<string | null>(null);
  const sttWsRef = useRef<SttWebSocketStream | null>(null);
  const wsFailedRef = useRef(false);
  const recordingActiveRef = useRef(false);
  const incrementalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incrementalKickoffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIncrementalSizeRef = useRef(0);
  const incrementalInFlightRef = useRef(false);
  const wsLastPartialAtRef = useRef(0);
  const pcmCaptureRef = useRef<PcmCaptureHandle | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingDurationRef = useRef(0);
  // Skip AI suggestions when SOAP was just generated by AI (to avoid duplicate API calls)
  const aiJustPopulatedRef = useRef(false);

  const loadConsultationRecordings = useCallback(async () => {
    setRecordingsLoading(true);
    try {
      const rows = await listConsultationRecordings(appointmentId);
      const withUrls = await Promise.all(
        rows.map(async (rec) => {
          const audioUrl = await getConsultationAudioUrl(rec.audio_storage_path);
          return { ...rec, audioUrl };
        })
      );
      setConsultationRecordings(withUrls);
    } catch {
      setConsultationRecordings([]);
    } finally {
      setRecordingsLoading(false);
    }
  }, [appointmentId]);

  const resolveRecordingAudioUrl = useCallback(async (storagePath: string) => {
    return getConsultationAudioUrl(storagePath);
  }, []);

  const regenerateTranscriptFromRecordings = useCallback(async (
    recs: Array<ConsultationRecording & { audioUrl?: string | null }>
  ) => {
    if (recs.length === 0) return;

    const apis = { transcribe: true, diarize: true, session: false };
    setRegeneratingRecordingId(recs[0].id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let currentTranscript = transcript;
      let totalTurns = 0;

      for (const rec of recs) {
        setRegeneratingRecordingId(rec.id);
        const url = rec.audioUrl ?? await getConsultationAudioUrl(rec.audio_storage_path);
        if (!url) throw new Error(`Không tải được file ghi âm ${rec.id}.`);
        const audioRes = await fetch(url);
        if (!audioRes.ok) throw new Error('Không tải được file ghi âm.');
        const audioBlob = await audioRes.blob();

        const existingTurns = rec.transcript_snapshot?.length ? rec.transcript_snapshot : currentTranscript;
        const result = await regenerateTranscriptFromAudio({
          audioBlob,
          existingTranscript: transcriptToPlainText(existingTurns),
          existingTurns,
          apis,
          session: user ? { appointmentId, doctorId: user.id } : undefined,
        });

        if (result.sessionWarning) {
          toast.warning(result.sessionWarning);
        }

        currentTranscript = [...currentTranscript, ...result.turns];
        totalTurns += result.turns.length;
        await persistRegeneratedTranscript({
          appointmentId,
          fullTranscript: currentTranscript,
          recordingId: rec.id,
          newTurns: result.turns,
        });
        setConsultationRecordings((prev) =>
          prev.map((row) => (row.id === rec.id ? { ...row, transcript_snapshot: result.turns } : row))
        );
      }

      setTranscript(currentTranscript);
      toast.success(`Đã nối ${totalTurns} lượt hội thoại từ ${recs.length} bản ghi.`);
    } catch (e) {
      toast.error((e as Error).message || 'Không gen lại được transcript.');
    } finally {
      setRegeneratingRecordingId(null);
    }
  }, [appointmentId, transcript]);

  // Refs for EMR auto-save and debounce
  const examIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const icdSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoapTextRef = useRef('');
  const lastSavedFormRef = useRef<SoapFormData>(DEFAULT_SOAP_FORM);

  // ─── Helper: perform auto-save ────────────────────────────────────────────

  const performAutoSave = useCallback(async () => {
    if (!examIdRef.current) return;
    const errors = validateSoapForSave(formData, exam?.icd_codes ?? []);
    if (Object.keys(errors).length > 0) return;
    try {
      await saveSoapDraft(examIdRef.current, formData);
      lastSavedFormRef.current = { ...formData };
      setAutoSavedAt(new Date());
    } catch {
      // Silent fail for auto-save
    }
  }, [exam?.icd_codes, formData]);

  // ─── Helper: trigger AI suggestions ──────────────────────────────────────

  const triggerAiSuggestions = useCallback(async () => {
    if (!formData.s_text && !formData.o_text) {
      setAiSuggestions([]);
      return;
    }
    if ((formData.s_text + formData.o_text).length < 30) return;

    setAiLoading(true);
    try {
      // RULE-015a/b: AI cannot modify SOAP, only suggest
      const suggestions = await getAiIcdSuggestions(formData.s_text, formData.o_text);
      setAiSuggestions(suggestions);
    } catch {
      // RULE-015d: AI failure does not block exam
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  }, [formData.s_text, formData.o_text]);

  // ─── Helper: ICD search ───────────────────────────────────────────────────

  const performIcdSearch = async (query: string) => {
    setIcdSearchLoading(true);
    try {
      const results = await searchIcd10(query);
      setIcdSearchResults(results);
    } catch {
      setIcdSearchResults([]);
    } finally {
      setIcdSearchLoading(false);
    }
  };

  // ─── Reload exam from server ──────────────────────────────────────────────

  const reloadActivityLogs = useCallback(async (examId: string) => {
    try {
      setActivityLogs(await listExaminationActivityLog(examId));
    } catch {
      setActivityLogs([]);
    }
  }, []);

  const reloadExam = useCallback(async () => {
    try {
      const updated = await getExaminationByAppointment(appointmentId);
      if (updated) {
        setExam(updated);
        if (updated.auto_saved_at) {
          setAutoSavedAt(new Date(updated.auto_saved_at));
        }
        await reloadActivityLogs(updated.id);
      }
    } catch {
      // Non-critical
    }
  }, [appointmentId, reloadActivityLogs]);

  // ─── Recording audio playback ─────────────────────────────────────────────

  // ─── Load exam, voice session & risk assessment ───────────────────────────

  useEffect(() => {
    if (!appointmentId) return;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        const profile = await getMyDoctorProfile().catch(() => null);
        if (profile) {
          setHasPinSet(profile.has_pin);
          setPinLockedUntil(profile.pin_locked_until);
        } else {
          setHasPinSet(await checkDoctorPinSet());
        }

        const examId = await resolveExaminationId(appointmentId);
        examIdRef.current = examId;

        // Load full exam data
        const loadedExam = await getExaminationByAppointment(appointmentId);
        if (loadedExam) {
          setExam(loadedExam);
          setFormData({
            s_text: loadedExam.s_text ?? '',
            o_text: loadedExam.o_text ?? '',
            a_text: loadedExam.a_text ?? '',
            p_text: loadedExam.p_text ?? '',
          });
          lastSavedFormRef.current = {
            s_text: loadedExam.s_text ?? '',
            o_text: loadedExam.o_text ?? '',
            a_text: loadedExam.a_text ?? '',
            p_text: loadedExam.p_text ?? '',
          };
          if (loadedExam.auto_saved_at) {
            setAutoSavedAt(new Date(loadedExam.auto_saved_at));
          }
          await reloadActivityLogs(loadedExam.id);
        }

        // Load voice session transcript + recording history
        const voiceSession = await getVoiceSession(appointmentId).catch(() => null);
        if (voiceSession) {
          setTranscript(
            resolveTranscriptTurns(voiceSession.transcript_edited, voiceSession.transcript_raw)
          );
        }
        await loadConsultationRecordings();

        setAiCircuitOpen(isAiCircuitOpen());

        // Load risk assessment
        const risk = await getRiskAssessment(examId).catch(() => null);
        setRiskAssessment(risk);

      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [appointmentId]);

  // ─── Auto-save every 30 seconds (RULE-010d) ───────────────────────────────

  useEffect(() => {
    if (!examIdRef.current || exam?.status === 'LOCKED') return;

    autoSaveTimerRef.current = setInterval(() => {
      void performAutoSave();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [exam?.status, formData, performAutoSave]);

  // ─── AI suggestion debounce (RULE-015: 2s debounce) ──────────────────────

  useEffect(() => {
    if (exam?.status === 'LOCKED') return;

    const currentText = formData.s_text + formData.o_text;
    if (currentText === lastSoapTextRef.current) return;
    lastSoapTextRef.current = currentText;

    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

    aiDebounceRef.current = setTimeout(() => {
      // Skip if AI just populated the form (ICD suggestions already included)
      if (aiJustPopulatedRef.current) {
        aiJustPopulatedRef.current = false;
        return;
      }
      void triggerAiSuggestions();
    }, AI_DEBOUNCE_MS);

    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [formData.s_text, formData.o_text, exam?.status, triggerAiSuggestions]);

  // ─── ICD search debounce ──────────────────────────────────────────────────

  useEffect(() => {
    if (icdSearchDebounceRef.current) clearTimeout(icdSearchDebounceRef.current);
    if (!icdSearch.trim() || icdSearch.length < 2) {
      setIcdSearchResults([]);
      return;
    }

    icdSearchDebounceRef.current = setTimeout(() => {
      void performIcdSearch(icdSearch);
    }, 500);

    return () => {
      if (icdSearchDebounceRef.current) clearTimeout(icdSearchDebounceRef.current);
    };
  }, [icdSearch]);



  // ─── Public: update field ─────────────────────────────────────────────────

  const updateField = useCallback((field: keyof SoapFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear AI badge when modified
    setSoapSourceBadge((prev) => ({ ...prev, [field]: false }));
  }, []);

  // ─── Public: manual save ──────────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    if (!examIdRef.current) return;
    const errors = validateSoapForSave(formData, exam?.icd_codes ?? []);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }
    setSaving(true);
    try {
      await saveSoapDraft(examIdRef.current, formData, {
        manual: true,
        changedFields: diffSoapFormFields(lastSavedFormRef.current, formData),
      });
      lastSavedFormRef.current = { ...formData };
      setAutoSavedAt(new Date());
      await reloadActivityLogs(examIdRef.current);
      toast.success('Đã lưu hồ sơ');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [exam?.icd_codes, formData, reloadActivityLogs]);

  // ─── Public: add ICD code ─────────────────────────────────────────────────

  const addIcdCode = useCallback(
    async (code: string, name: string, isManual = false) => {
      if (!examIdRef.current) return;
      try {
        await upsertIcdCode({
          examId: examIdRef.current,
          icdCode: code,
          icdName: name,
          isAiSuggested: !isManual,
          confirmStatus: isManual ? 'CONFIRMED' : 'PENDING',
        });
        await reloadExam();
        if (isManual) toast.success(`Đã thêm ICD ${code}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [reloadExam]
  );

  // ─── Public: confirm AI suggestion ───────────────────────────────────────

  const confirmIcd = useCallback(
    async (icd: SoapIcdCode) => {
      if (!examIdRef.current) return;
      try {
        await confirmIcdCode(examIdRef.current, icd.icd_code, icd.icd_name);
        await reloadExam();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [reloadExam]
  );

  // ─── Public: reject AI suggestion ────────────────────────────────────────

  const rejectIcd = useCallback(
    async (icd: SoapIcdCode) => {
      if (!examIdRef.current) return;
      try {
        await rejectIcdCode(examIdRef.current, icd.icd_code, icd.icd_name);
        await reloadExam();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [reloadExam]
  );

  // ─── Public: remove ICD ───────────────────────────────────────────────────

  const removeIcd = useCallback(
    async (icd: SoapIcdCode) => {
      try {
        await removeIcdCode(icd.id);
        await reloadExam();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [reloadExam]
  );

  const collectRecordedAudio = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
            : null
        );
        return;
      }

      recorder.onstop = () => {
        resolve(
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
            : null
        );
      };
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    });

  // ─── Live transcript polling while recording ─────────────────────────────

  const stopLiveTranscriptPolling = useCallback(() => {
    if (incrementalKickoffRef.current) {
      clearTimeout(incrementalKickoffRef.current);
      incrementalKickoffRef.current = null;
    }
    if (incrementalTimerRef.current) {
      clearInterval(incrementalTimerRef.current);
      incrementalTimerRef.current = null;
    }
    lastIncrementalSizeRef.current = 0;
    incrementalInFlightRef.current = false;
    setIsLiveTranscribing(false);
  }, []);

  const pollLiveTranscript = useCallback(async () => {
    if (!recordingActiveRef.current || incrementalInFlightRef.current) return;

    // WS partials are flowing — skip HTTP polling to avoid overwriting live draft
    const wsActive = !wsFailedRef.current && Date.now() - wsLastPartialAtRef.current < 2500;
    if (wsActive) return;

    const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mime });
    const MIN_SIZE = 2000;
    const MIN_GROWTH = 800;
    if (blob.size < MIN_SIZE) return;
    if (blob.size <= lastIncrementalSizeRef.current + MIN_GROWTH) return;

    incrementalInFlightRef.current = true;
    setIsLiveTranscribing(true);
    setSoapJobStatus('streaming');

    try {
      const { turns } = await buildLiveTranscriptFromSnapshot(blob);
      if (!recordingActiveRef.current) return;
      if (turns.length > 0) {
        setTranscript(turns);
        const last = turns[turns.length - 1];
        if (last) {
          setStreamingDraft({ text: last.text, speaker: last.speaker });
        }
        lastIncrementalSizeRef.current = blob.size;
        recordAiSuccess();
      }
    } catch {
      // Silent during live poll — final stop will retry
    } finally {
      incrementalInFlightRef.current = false;
      if (recordingActiveRef.current) {
        setIsLiveTranscribing(false);
      }
    }
  }, []);

  const startLiveTranscriptPolling = useCallback(() => {
    stopLiveTranscriptPolling();
    const tick = () => { void pollLiveTranscript(); };
    incrementalKickoffRef.current = setTimeout(tick, 1500);
    incrementalTimerRef.current = setInterval(tick, 1200);
  }, [pollLiveTranscript, stopLiveTranscriptPolling]);

  // ─── Voice recording & transcription (FR-023) ──────────────────────────────

  const startRecording = async () => {
    if (!recordingConsent) {
      toast.error('Vui lòng xác nhận đã thông báo và nhận sự đồng ý của bệnh nhân.');
      return;
    }

    if (isAiCircuitOpen()) {
      setSttFallbackMode(true);
      toast.warning('Dịch vụ AI tạm ngưng. Vui lòng nhập bệnh án thủ công hoặc transcript tay.');
      return;
    }

    try {
      const healthy = await checkSttApiHealth();
      if (!healthy) {
        recordAiFailure();
        setSttFallbackMode(true);
        toast.warning('Dịch vụ STT không khả dụng. Chuyển sang chế độ nhập tay.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const session = await createSttSession({
        appointmentId,
        doctorId: user.id,
        consentConfirmed: true,
      });
      sttSessionIdRef.current = session.session_id;
      wsLastPartialAtRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const wsStream = new SttWebSocketStream();
      sttWsRef.current = wsStream;
      wsFailedRef.current = false;

      try {
        await wsStream.connect(session.ws_url, {
          onPartial: (text, speaker) => {
            wsLastPartialAtRef.current = Date.now();
            setStreamingDraft({ text, speaker: speaker ?? 'doctor' });
            setSoapJobStatus('streaming');
          },
          onFinalTurn: (turn) => {
            wsLastPartialAtRef.current = Date.now();
            setTranscript((prev) => [...prev, turn]);
            setStreamingDraft(null);
          },
          onError: () => {
            wsFailedRef.current = true;
          },
          onConnected: () => {
            setIsWsStreaming(true);
            setSoapJobStatus('streaming');
          },
        }, { audioEncoding: 'pcm' });
      } catch {
        wsFailedRef.current = true;
        sttWsRef.current = null;
      }

      if (sttWsRef.current?.isConnected()) {
        try {
          pcmCaptureRef.current = await startPcmCapture(stream, (pcm) => {
            sttWsRef.current?.sendPcmChunk(pcm);
          });
        } catch {
          wsFailedRef.current = true;
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined;
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          // WebM fallback only when PCM stream is unavailable
          if (wsFailedRef.current && sttWsRef.current?.isConnected()) {
            sttWsRef.current.sendAudioChunk(e.data);
          }
        }
      };

      mediaRecorder.start(250);
      recordingActiveRef.current = true;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      setTranscript([]);
      setStreamingDraft(null);
      setNlpAnalysis(null);
      setSoapJobStatus('streaming');
      startLiveTranscriptPolling();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);

      toast.success(
        wsFailedRef.current
          ? 'Ghi âm — transcript cập nhật liên tục (~1 giây/lần).'
          : 'Ghi âm realtime — nói đến đâu hiện chữ đến đó.'
      );
    } catch (e) {
      pcmCaptureRef.current?.stop();
      pcmCaptureRef.current = null;
      sttWsRef.current?.disconnect();
      sttWsRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingActiveRef.current = false;
      stopLiveTranscriptPolling();
      toast.error(
        e instanceof Error && e.message !== 'Chưa đăng nhập'
          ? e.message
          : 'Không truy cập được microphone. Vui lòng kiểm tra quyền trình duyệt.'
      );
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    recordingActiveRef.current = false;
    stopLiveTranscriptPolling();
    pcmCaptureRef.current?.stop();
    pcmCaptureRef.current = null;
    setIsRecording(false);
    setIsWsStreaming(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    setIsTranscribing(true);
    setSoapJobStatus('transcribing');
    toast.info('Đang hoàn tất phiên ghi âm và phân tích hội thoại...');

    try {
      const audioBlob = await collectRecordedAudio();
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Không thu được dữ liệu âm thanh. Vui lòng thử ghi âm lại.');
      }

      let turns = transcript;

      if (sttWsRef.current && !wsFailedRef.current) {
        const wsTurns = await sttWsRef.current.stop();
        if (wsTurns.length > 0) {
          turns = wsTurns;
          setTranscript(wsTurns);
        }
        sttWsRef.current = null;
      }

      setStreamingDraft(null);

      if (turns.length === 0) {
        const batch = await buildTranscriptFromAudio(audioBlob);
        turns = batch.turns;
        if (turns.length === 0) {
          throw new Error('Không nhận diện được nội dung hội thoại từ file ghi âm.');
        }
        setTranscript(turns);
      }

      recordAiSuccess();

      const durationSeconds = recordingDurationRef.current;
      const saved = await saveVoiceSession(appointmentId, turns, audioBlob, undefined, {
        durationSeconds,
      });
      if (saved.storagePath) {
        const persistedUrl = saved.audioUrl ?? await getConsultationAudioUrl(saved.storagePath);
        setConsultationRecordings((prev) => [
          {
            id: saved.recordingId ?? `${Date.now()}`,
            appointment_id: appointmentId,
            doctor_id: '',
            audio_storage_path: saved.storagePath!,
            duration_seconds: durationSeconds,
            transcript_snapshot: turns,
            created_at: new Date().toISOString(),
            audioUrl: persistedUrl,
          },
          ...prev,
        ]);
      } else {
        await loadConsultationRecordings();
      }
      toast.success('Đã lưu bản ghi âm và transcript phiên khám.');

      // generateSoap handles analyze + SOAP generation + ICD suggestions in one bundle
      await generateSoap(turns);
      setSoapJobStatus('done');
    } catch (e) {
      recordAiFailure();
      setSttFallbackMode(true);
      setSoapJobStatus('error');
      setAiCircuitOpen(isAiCircuitOpen());
      sttWsRef.current?.disconnect();
      sttWsRef.current = null;
      toast.error(
        (e as Error).message || 'Lỗi xử lý ghi âm. Chuyển sang chế độ nhập tay.',
        { description: 'Bạn có thể nhập transcript thủ công bên dưới.' }
      );
    } finally {
      setIsTranscribing(false);
      setIsWsStreaming(false);
      sttSessionIdRef.current = null;
    }
  };

  const updateTranscriptLine = useCallback((index: number, text: string) => {
    setTranscript((prev) => prev.map((line, i) => (i === index ? { ...line, text } : line)));
  }, []);

  const addManualTranscriptLine = useCallback((speaker: 'doctor' | 'patient', text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => [...prev, { speaker, text: text.trim() }]);
    setSttFallbackMode(true);
  }, []);

  const removeTranscriptLine = useCallback(async (index: number) => {
    if (isRecording) return;

    const previous = transcript;
    const next = previous.filter((_, i) => i !== index);
    setTranscript(next);
    try {
      await persistTranscriptLines(appointmentId, next);
      toast.success('Đã xóa dòng hội thoại.');
    } catch (e) {
      setTranscript(previous);
      toast.error((e as Error).message);
    }
  }, [appointmentId, isRecording, transcript]);

  const saveTranscriptEdit = useCallback(async () => {
    try {
      await updateTranscriptEdited(appointmentId, transcript);
      toast.success('Đã lưu bản hiệu chỉnh transcript.');
      setIsEditingTranscript(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [appointmentId, transcript]);

  // ─── AI SOAP Note Generator (FR-024) ──────────────────────────────────────────

  const generateSoap = async (
    transcriptOverride?: VoiceSession['transcript_raw']
  ) => {
    if (isAiCircuitOpen()) {
      toast.warning('Dịch vụ AI tạm ngưng 5 phút. Vui lòng nhập SOAP thủ công.');
      setAiCircuitOpen(true);
      return;
    }

    setIsGeneratingSoap(true);
    setSoapJobStatus('generating');
    try {
      // Single bundled call: analyze + SOAP + ICD suggestions (no duplicate API calls)
      const generated = await generateSoapFromAi(appointmentId, transcriptOverride ?? transcript);
      recordAiSuccess();

      if (generated.analysis) {
        setNlpAnalysis(generated.analysis);
        // Show red flags warning from analysis
        if (generated.analysis.red_flags.length > 0) {
          toast.warning(`Phát hiện ${generated.analysis.red_flags.length} dấu hiệu cảnh báo từ hội thoại.`);
        }
      }

      const newForm = {
        s_text: generated.s_text,
        o_text: generated.o_text,
        a_text: generated.a_text,
        p_text: generated.p_text,
      };

      setFormData(newForm);
      // Mark that AI just populated the form - skip subsequent triggerAiSuggestions
      aiJustPopulatedRef.current = true;

      if (examIdRef.current) {
        await saveSoapAiBaseline(examIdRef.current, newForm);
      }

      setSoapSourceBadge({
        s_text: true,
        o_text: true,
        a_text: true,
        p_text: true,
      });

      for (const icd of generated.icd_codes) {
        if (!examIdRef.current) continue;
        await upsertIcdCode({
          examId: examIdRef.current,
          icdCode: icd.code,
          icdName: icd.name,
          isAiSuggested: true,
          aiConfidence: icd.confidence,
          aiReason: icd.reason,
          confirmStatus: 'PENDING',
        });
      }

      await reloadExam();
      setSoapJobStatus('done');
      toast.success('Đã tạo SOAP Note từ AI (Module 5/6).');
    } catch (e) {
      recordAiFailure();
      setSoapJobStatus('error');
      setAiCircuitOpen(isAiCircuitOpen());
      toast.error((e as Error).message || 'Gặp lỗi khi tạo SOAP Note tự động.');
    } finally {
      setIsGeneratingSoap(false);
    }
  };

  // ─── Patient Risk Assessment Recalculation (FR-025) ──────────────────────────

  const recalcRisk = async () => {
    if (!examIdRef.current) return;
    setRiskLoading(true);
    try {
      // Force calculation RPC
      const result = await recalculateRiskScore(examIdRef.current);
      setRiskAssessment(result);
      toast.success('Đã tính toán lại điểm rủi ro của bệnh nhân.');
    } catch (e) {
      toast.error('Lỗi khi tính điểm rủi ro: ' + (e as Error).message);
    } finally {
      setRiskLoading(false);
    }
  };

  // ─── Public: sign examination (with PIN) ───────────────────────────────────

  const sign = useCallback(
    async (params: { pin: string | null; responsibilityAck: boolean }): Promise<string | null> => {
      if (!examIdRef.current) return 'Không tìm thấy hồ sơ khám.';

      // Validate before sending
      const currentIcds = exam?.icd_codes ?? [];
      const errors = validateSoapForSign(formData, currentIcds);
      if (Object.keys(errors).length > 0) {
        const firstError = Object.values(errors)[0];
        toast.error(firstError);
        return firstError;
      }

      setSubmitting(true);
      try {
        // Save latest draft first
        await saveSoapDraft(examIdRef.current, formData);

        // Sign & Lock with PIN verification
        await signExamination({
          examId: examIdRef.current,
          pinPlain: params.pin?.trim() || null,
          responsibilityAck: params.responsibilityAck,
        });

        // Trigger dynamic Risk scoring immediately after signing
        const updatedRisk = await recalculateRiskScore(examIdRef.current).catch(() => null);
        setRiskAssessment(updatedRisk);

        toast.success('Hồ sơ khám đã được ký số và đóng băng thành công.');
        const signedExam = await getExaminationByAppointment(appointmentId);
        if (signedExam?.patient_id) {
          appendHealthRecordVersion(signedExam.patient_id, signedExam);
          const { data: apptRow } = await supabase
            .from('appointments')
            .select('profile_id')
            .eq('id', signedExam.appointment_id)
            .maybeSingle();
          if (apptRow?.profile_id) {
            appendHealthRecordVersion(String(apptRow.profile_id), signedExam);
          }
        }
        await reloadExam();
        return null;
      } catch (e) {
        const message = (e as Error).message;
        toast.error(message);
        if (isPinSignLockMessage(message)) {
          setPinLockedUntil(new Date(Date.now() + 10 * 60 * 1000).toISOString());
        }
        return message;
      } finally {
        setSubmitting(false);
      }
    },
    [exam, formData, reloadExam, appointmentId]
  );

  const refreshPinLock = useCallback(async () => {
    try {
      const profile = await getMyDoctorProfile();
      setHasPinSet(profile.has_pin);
      setPinLockedUntil(profile.pin_locked_until);
    } catch {
      // keep last known lock state
    }
  }, []);

  // ─── Public: setup PIN ────────────────────────────────────────────────────

  const setupPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      await setDoctorPin(pin);
      setHasPinSet(true);
      toast.success('Mã PIN ký số đã được thiết lập.');
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  }, []);

  return {
    exam,
    formData,
    loading,
    saving,
    submitting,
    error,
    isLocked: exam?.status === 'LOCKED',
    autoSavedAt,
    hasPinSet,
    pinLockedUntil,
    refreshPinLock,

    aiSuggestions,
    aiLoading,
    icdSearch,
    icdSearchResults,
    icdSearchLoading,

    // Voice recording & transcription
    isRecording,
    isTranscribing,
    recordingDuration,
    recordingConsent,
    setRecordingConsent,
    transcript,
    streamingDraft,
    isWsStreaming,
    isLiveTranscribing,
    nlpAnalysis,
    startRecording,
    stopRecording,
    sttFallbackMode,
    isEditingTranscript,
    setIsEditingTranscript,
    updateTranscriptLine,
    saveTranscriptEdit,
    addManualTranscriptLine,
    removeTranscriptLine,
    aiCircuitOpen,
    aiCircuitCooldownMs: getAiCircuitCooldownRemaining(),
    consultationRecordings,
    recordingsLoading,
    resolveRecordingAudioUrl,
    regeneratingRecordingId,
    regenerateTranscriptFromRecordings,

    // SOAP auto-generation
    isGeneratingSoap,
    soapJobStatus,
    generateSoap,
    soapSourceBadge,

    // Risk assessment
    riskAssessment,
    riskLoading,
    recalcRisk,

    updateField,
    saveDraft,
    activityLogs,

    addIcdCode,
    confirmIcd,
    rejectIcd,
    removeIcd,
    setIcdSearch,

    sign,
    setupPin,
  };
}
