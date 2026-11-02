/**
 * FR-010: SOAP Note Editor — Main EMR component for doctors
 * Multi-panel layout: Patient info + SOAP form + ICD panel + Voice Assistant
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Activity, AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronUp,
  Loader2, Lock, Sparkles, X,
  Mic, StopCircle, Brain, TrendingUp, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useSoapNoteEditor } from '@/hooks/useSoapNoteEditor';
import type { SoapIcdCode, AiIcdSuggestion } from '@/types/emr';
import { isDoctorPinLocked, validateSoapForSign } from '@/types/emr';
import IcdSearchPanel from './IcdSearchPanel';
import DoctorSignOffDialog from './DoctorSignOffDialog';
import SetupPinDialog from './SetupPinDialog';
import VitalSignsReadOnly, { type VitalSignsSummary } from './VitalSignsReadOnly';
import PreConsultationReadOnly from './PreConsultationReadOnly';
import QuestionnaireAssignPanel from './QuestionnaireAssignPanel';
import VoiceRecordingHistory from './VoiceRecordingHistory';
import ExamComprehensiveLogControl from './ExamComprehensiveLogControl';
import ExamAddendumForm from './ExamAddendumForm';

type PatientInfo = {
  name: string;
  age?: string | number;
  gender?: string;
  phone?: string;
};

type SoapNoteEditorProps = {
  appointmentId: string;
  patient?: PatientInfo;
  /** e.g. "11:00 · 31/10/2026" */
  scheduleLabel?: string;
  specialty?: string;
  statusLabel?: string;
  onBack?: () => void;
};

type AssistantTab = 'voice' | 'ai' | 'search';

const FOLLOW_UP_TEMPLATE = 'Tái khám sau 2 tuần hoặc sớm hơn nếu triệu chứng nặng lên.';

export default function SoapNoteEditor({
  appointmentId, patient, scheduleLabel, specialty, statusLabel, onBack,
}: SoapNoteEditorProps) {
  const editor = useSoapNoteEditor(appointmentId);
  const [showSignOff, setShowSignOff] = useState(false);
  const [showSetupPin, setShowSetupPin] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [manualLine, setManualLine] = useState('');
  const [manualSpeaker, setManualSpeaker] = useState<'doctor' | 'patient'>('doctor');
  const [assistantTab, setAssistantTab] = useState<AssistantTab>('voice');
  const [vitalsSummary, setVitalsSummary] = useState<VitalSignsSummary | null>(null);
  const [sectionExpanded, setSectionExpanded] = useState({
    vitals: true,
    preConsult: false,
    questionnaires: false,
  });

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (editor.error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{editor.error}</AlertDescription>
      </Alert>
    );
  }

  const confirmedIcds = editor.exam?.icd_codes.filter((c) => c.confirm_status === 'CONFIRMED') ?? [];
  const pendingIcds = editor.exam?.icd_codes.filter((c) => c.confirm_status === 'PENDING') ?? [];

  const openSignOff = () => {
    const errors = validateSoapForSign(editor.formData, editor.exam?.icd_codes ?? []);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }
    void editor.refreshPinLock().then(() => setShowSignOff(true));
  };

  const patientName = patient?.name ?? 'Bệnh nhân';
  const patientInitial = patientName.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? 'B';
  const patientMeta = [
    patient?.gender,
    patient?.age != null && patient.age !== '' ? `${patient.age} tuổi` : null,
    patient?.phone,
    scheduleLabel ? `Lịch ${scheduleLabel}` : null,
    specialty,
  ].filter(Boolean).join(' · ');

  const soapFields = ['s_text', 'o_text', 'a_text', 'p_text'] as const;
  const soapFilled = soapFields.filter((k) => editor.formData[k].trim()).length;

  const appendToField = (key: (typeof soapFields)[number], text: string) => {
    const current = editor.formData[key];
    editor.updateField(key, current.trim() ? `${current.replace(/\s+$/, '')}\n${text}` : text);
  };

  const insertIcdIntoAssessment = () => {
    if (confirmedIcds.length === 0) {
      toast.error('Chưa có mã ICD nào được xác nhận');
      return;
    }
    appendToField('a_text', confirmedIcds.map((c) => `${c.icd_code} ${c.icd_name}`).join('; '));
  };

  const insertVitalsIntoObjective = () => {
    if (!vitalsSummary?.text) {
      toast.error('Chưa có dữ liệu sinh hiệu');
      return;
    }
    appendToField('o_text', vitalsSummary.text);
  };

  const requestAiSoap = () => {
    if (editor.transcript.length === 0) {
      toast.error('Chưa có hội thoại phiên khám để tạo SOAP');
      return;
    }
    setShowRegenerateConfirm(true);
  };

  return (
    <div className="flex flex-col h-full bg-muted/40">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center gap-3.5 border-b px-4 py-3 bg-card flex-shrink-0 z-10">
        {onBack && (
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            aria-label="Quay lại lịch hẹn"
            title="Quay lại lịch hẹn"
            className="h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground">
          {patientInitial}
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold leading-tight text-foreground">{patientName}</h2>
            {statusLabel && (
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                  editor.isLocked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel}
              </span>
            )}
          </div>
          {patientMeta && <p className="text-xs text-muted-foreground">{patientMeta}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!editor.isLocked && (
            <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
              {editor.autoSavedAt
                ? `Tự lưu ${formatDistanceToNow(editor.autoSavedAt, { locale: vi, addSuffix: true })}`
                : 'Chưa lưu nháp'}
            </span>
          )}

          {editor.exam && (
            <ExamComprehensiveLogControl exam={editor.exam} logs={editor.activityLogs} />
          )}

          {editor.isLocked ? (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 gap-1">
              <Lock className="h-3 w-3" /> Đã ký số bảo mật
            </Badge>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void editor.saveDraft()}
                disabled={editor.saving || editor.submitting || editor.isRecording || editor.isTranscribing}
                className="h-9 px-3 font-medium"
              >
                {editor.saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Lưu nháp
              </Button>
              <Button
                size="sm"
                onClick={openSignOff}
                disabled={editor.submitting || editor.isRecording || editor.isTranscribing}
                className="h-9 px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editor.submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Hoàn tất & Ký duyệt
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Main content: SOAP + sidebar ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: SOAP editor */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 pt-4 pb-6 space-y-3">
          {editor.isLocked && editor.exam && !editor.exam.is_addendum && (
            <ExamAddendumForm examId={editor.exam.id} />
          )}
          {/* Patient Risk Score Card (FR-025) */}
          {editor.riskAssessment && (
            <Card className="border-primary/10 overflow-hidden shadow-sm">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/5 to-transparent py-3.5 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                  <CardTitle className="text-sm font-bold text-slate-700">Đánh giá rủi ro lâm sàng (AI Risk Assessment)</CardTitle>
                </div>
                {!editor.isLocked && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void editor.recalcRisk()}
                    disabled={editor.riskLoading}
                    className="h-7 text-xs font-medium text-primary hover:bg-primary/10 px-2.5 rounded-md gap-1"
                  >
                    {editor.riskLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    Tính toán lại
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4 grid md:grid-cols-3 gap-4">
                <div className="flex flex-col justify-center items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-muted-foreground font-medium">Điểm rủi ro tổng hợp</span>
                  <div className="flex items-baseline mt-1.5 gap-1.5">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-800">{editor.riskAssessment.risk_score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <div className="mt-2.5">
                    {editor.riskAssessment.risk_level === 'HIGH' && (
                      <Badge className="bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold px-3 py-0.5 animate-pulse">
                        NGUY CƠ CAO (HIGH)
                      </Badge>
                    )}
                    {editor.riskAssessment.risk_level === 'MODERATE' && (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold px-3 py-0.5">
                        TRUNG BÌNH (MODERATE)
                      </Badge>
                    )}
                    {editor.riskAssessment.risk_level === 'LOW' && (
                      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold px-3 py-0.5">
                        NGUY CƠ THẤP (LOW)
                      </Badge>
                    )}
                  </div>
                  {editor.riskAssessment.override_applied && (
                    <span className="text-[10px] font-semibold text-rose-600 mt-2 text-center bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      🚨 Override Sinh Hiệu Khẩn Cấp
                    </span>
                  )}
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700">Yếu tố cấu thành rủi ro:</span>
                    <div className="space-y-2 mt-1.5">
                      {editor.riskAssessment.risk_factors.map((f, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span className="truncate">{f.factor}</span>
                            <span>+{f.contribution_pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                editor.riskAssessment?.risk_level === 'HIGH'
                                  ? 'bg-rose-500'
                                  : editor.riskAssessment?.risk_level === 'MODERATE'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${f.contribution_pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {editor.riskAssessment.risk_factors.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Không phát hiện yếu tố bất thường nghiêm trọng.</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700">Đề xuất can thiệp:</span>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed bg-primary/5 p-2 rounded-lg border border-primary/5 font-medium">
                      {editor.riskAssessment.recommendation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Context panels (vitals, pre-consult) */}
          <ExpandableSection
            title="Sinh hiệu"
            meta={
              <>
                {(vitalsSummary?.abnormalCount ?? 0) > 0 && (
                  <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {vitalsSummary?.abnormalCount} chỉ số bất thường
                  </span>
                )}
                {vitalsSummary?.measuredAt && (
                  <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                    Đo lúc {vitalsSummary.measuredAt}
                  </span>
                )}
              </>
            }
            expanded={sectionExpanded.vitals}
            onToggle={() => setSectionExpanded((p) => ({ ...p, vitals: !p.vitals }))}
          >
            <VitalSignsReadOnly appointmentId={appointmentId} onLoaded={setVitalsSummary} />
          </ExpandableSection>

          <ExpandableSection
            title="Khai báo y tế trước khám"
            expanded={sectionExpanded.preConsult}
            onToggle={() => setSectionExpanded((p) => ({ ...p, preConsult: !p.preConsult }))}
          >
            <PreConsultationReadOnly appointmentId={appointmentId} />
          </ExpandableSection>

          <ExpandableSection
            title="Bộ câu hỏi lâm sàng"
            expanded={sectionExpanded.questionnaires}
            onToggle={() => setSectionExpanded((p) => ({ ...p, questionnaires: !p.questionnaires }))}
          >
            {editor.exam && (
              <QuestionnaireAssignPanel
                appointmentId={appointmentId}
                patientId={editor.exam.patient_id}
              />
            )}
          </ExpandableSection>

          {/* ICD-10 diagnosis */}
          <div className="rounded-xl border bg-card px-4 py-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold text-foreground">Chẩn đoán ICD-10</span>
              <span className="text-primary">*</span>
              <span className="text-xs text-muted-foreground">
                {confirmedIcds.length > 0 ? `${confirmedIcds.length} mã đã chọn` : 'Chưa chọn mã'}
              </span>
              <span className="flex-1" />
              {!editor.isLocked && (
                <>
                  <button
                    type="button"
                    onClick={() => setAssistantTab('ai')}
                    className="whitespace-nowrap text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    AI gợi ý
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssistantTab('search')}
                    className="whitespace-nowrap text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    + Tìm mã ICD
                  </button>
                </>
              )}
            </div>
            {confirmedIcds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {confirmedIcds.map((icd) => (
                  <ConfirmedIcdBadge
                    key={icd.id}
                    icd={icd}
                    onRemove={editor.isLocked ? undefined : () => void editor.removeIcd(icd)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SOAP sections */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Ghi chép SOAP</span>
              <span className="text-xs text-muted-foreground">{soapFilled}/4 mục đã nhập</span>
              <span className="flex-1" />
              {!editor.isLocked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestAiSoap}
                  disabled={editor.isGeneratingSoap || editor.isTranscribing || editor.isRecording}
                  className="h-8 gap-1.5 border-primary/25 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {editor.isGeneratingSoap
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                  {editor.isGeneratingSoap ? 'Đang tạo SOAP…' : 'Tạo SOAP bằng AI'}
                </Button>
              )}
            </div>

            <SoapSection
              letter="S"
              label="Subjective"
              tone="rose"
              description="Lời khai bệnh nhân: triệu chứng, bệnh sử, lý do"
              required
              value={editor.formData.s_text}
              onChange={(v) => editor.updateField('s_text', v)}
              locked={editor.isLocked}
              isAiSuggested={editor.soapSourceBadge.s_text}
              placeholder="Ví dụ: BN nam 35 tuổi, đau họng 3 ngày, sốt 38.5°C, ho khan không đờm, không khó thở..."
            />

            <SoapSection
              letter="O"
              label="Objective"
              tone="blue"
              description="Kết quả khám thực thể, sinh hiệu"
              required
              value={editor.formData.o_text}
              onChange={(v) => editor.updateField('o_text', v)}
              locked={editor.isLocked}
              isAiSuggested={editor.soapSourceBadge.o_text}
              placeholder="Ví dụ: Họng sung đỏ, amidan độ II. Phổi trong, không ran. HA 120/80, mạch 88..."
              toolLabel="+ Chèn sinh hiệu"
              onTool={insertVitalsIntoObjective}
            />

            <SoapSection
              letter="A"
              label="Assessment"
              tone="amber"
              description="Chẩn đoán lâm sàng tự do (ICD-10 chọn ở trên)"
              required
              value={editor.formData.a_text}
              onChange={(v) => editor.updateField('a_text', v)}
              locked={editor.isLocked}
              isAiSuggested={editor.soapSourceBadge.a_text}
              placeholder="Mô tả chẩn đoán bổ sung, tóm tắt lâm sàng..."
              toolLabel="+ Chèn mã ICD"
              onTool={insertIcdIntoAssessment}
            />

            <SoapSection
              letter="P"
              label="Plan"
              tone="emerald"
              description="Kế hoạch điều trị: hướng xử trí, kê đơn thuốc, chế độ sinh hoạt, tái khám"
              required
              value={editor.formData.p_text}
              onChange={(v) => editor.updateField('p_text', v)}
              locked={editor.isLocked}
              isAiSuggested={editor.soapSourceBadge.p_text}
              placeholder="Ví dụ: 1. Amoxicillin 500mg x 2v/ngày x 5 ngày. 2. Paracetamol 500mg khi sốt. 3. Tái khám sau 1 tuần nếu không giảm..."
              toolLabel="+ Mẫu tái khám"
              onTool={() => appendToField('p_text', FOLLOW_UP_TEMPLATE)}
            />
          </div>
        </div>

        {/* Right: Assistant & ICD panel */}
        {!editor.isLocked && (
          <div className="w-[360px] border-l flex flex-col min-h-0 overflow-hidden bg-card flex-shrink-0">
            <Tabs
              value={assistantTab}
              onValueChange={(v) => setAssistantTab(v as AssistantTab)}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="shrink-0 border-b px-3.5 py-3">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 rounded-lg p-[3px]">
                  <TabsTrigger value="voice" className="h-[30px] rounded-md text-xs font-semibold">
                    Trợ lý EMR
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="h-[30px] gap-1 rounded-md text-xs font-semibold">
                    AI gợi ý
                    {pendingIcds.length > 0 && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                        {pendingIcds.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="search" className="h-[30px] rounded-md text-xs font-semibold">Tìm ICD</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Tab 1: Voice Recording Assistant */}
              <TabsContent value="voice" className="mt-0 p-3.5 space-y-3 outline-none">
                <div className="space-y-3">
                  <div
                    className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition-colors ${
                      editor.recordingConsent
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-amber-200 bg-amber-50/70'
                    }`}
                  >
                    <Checkbox
                      id="consent"
                      checked={editor.recordingConsent}
                      onCheckedChange={(checked) => editor.setRecordingConsent(!!checked)}
                      disabled={editor.isRecording}
                      className={`mt-0.5 ${
                        editor.recordingConsent
                          ? 'border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white'
                          : 'border-amber-500'
                      }`}
                    />
                    <label htmlFor="consent" className="text-xs text-amber-900 leading-relaxed cursor-pointer select-none">
                      <strong className="font-semibold">Cam kết đồng ý:</strong> Bác sĩ xác nhận đã thông báo và nhận được sự đồng ý của bệnh nhân trước khi ghi âm cuộc khám bệnh.
                    </label>
                  </div>

                  {!editor.isRecording ? (
                    <Button
                      onClick={() => void editor.startRecording()}
                      disabled={editor.isTranscribing || editor.isGeneratingSoap}
                      className={`w-full h-[42px] rounded-[10px] gap-2 font-semibold text-primary-foreground transition-colors ${
                        editor.recordingConsent ? 'bg-primary hover:bg-primary/90' : 'bg-primary/30 hover:bg-primary/40'
                      }`}
                    >
                      <Mic className="h-4 w-4" /> Bắt đầu ghi âm realtime
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-[10px] border border-primary/20 bg-primary/5 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-ping motion-reduce:animate-none" />
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            {editor.isLiveTranscribing
                              ? 'Đang nhận diện giọng nói...'
                              : editor.isWsStreaming
                                ? 'Đang stream STT realtime...'
                                : 'Đang ghi âm...'}
                          </span>
                        </div>
                        <span className="text-sm font-mono font-bold text-primary">
                          {Math.floor(editor.recordingDuration / 60)
                            .toString()
                            .padStart(2, '0')}
                          :{(editor.recordingDuration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <Button
                        onClick={() => void editor.stopRecording()}
                        className="w-full h-[42px] rounded-[10px] gap-2 bg-foreground font-semibold text-background hover:bg-foreground/90"
                      >
                        <StopCircle className="h-5 w-5" /> Dừng & Tự động tạo SOAP
                      </Button>
                    </div>
                  )}

                  {editor.aiCircuitOpen && (
                    <Alert className="py-2 border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800">
                        Dịch vụ AI tạm ngưng 5 phút do lỗi liên tục. Vui lòng nhập SOAP thủ công.
                      </AlertDescription>
                    </Alert>
                  )}

                  {editor.sttFallbackMode && !editor.isRecording && (
                    <Alert className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Chế độ dự phòng: STT không khả dụng. Nhập transcript thủ công bên dưới.
                      </AlertDescription>
                    </Alert>
                  )}

                  {editor.soapJobStatus !== 'idle' && (
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 border rounded-xl text-xs">
                      <Loader2 className={`h-3.5 w-3.5 ${editor.soapJobStatus === 'done' || editor.soapJobStatus === 'error' ? 'hidden' : 'animate-spin'}`} />
                      <span className="font-medium text-slate-600">
                        {editor.soapJobStatus === 'streaming' && (
                          editor.isLiveTranscribing
                            ? 'Đang cập nhật transcript từ giọng nói...'
                            : 'Đang nhận transcript realtime...'
                        )}
                        {editor.soapJobStatus === 'transcribing' && 'Đang chuyển giọng nói...'}
                        {editor.soapJobStatus === 'analyzing' && 'Đang phân tích NLP...'}
                        {editor.soapJobStatus === 'generating' && 'Đang sinh SOAP Note...'}
                        {editor.soapJobStatus === 'done' && '✓ Hoàn tất xử lý AI'}
                        {editor.soapJobStatus === 'error' && '✗ Lỗi — chuyển sang nhập tay'}
                      </span>
                    </div>
                  )}

                  {editor.isTranscribing && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Đang chuyển giọng nói → transcript và phân tích NLP...
                    </div>
                  )}

                  {editor.nlpAnalysis?.red_flags && editor.nlpAnalysis.red_flags.length > 0 && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs space-y-1">
                        <strong>Dấu hiệu cảnh báo ({editor.nlpAnalysis.red_flags.length}):</strong>
                        <ul className="list-disc pl-4 mt-1">
                          {editor.nlpAnalysis.red_flags.map((flag, i) => (
                            <li key={i}>{flag.text}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {!editor.isRecording && (
                  <VoiceRecordingHistory
                    recordings={editor.consultationRecordings}
                    loading={editor.recordingsLoading}
                    resolveAudioUrl={editor.resolveRecordingAudioUrl}
                    onRegenerate={(recs) => void editor.regenerateTranscriptFromRecordings(recs)}
                    regenerating={Boolean(editor.regeneratingRecordingId)}
                    busy={editor.isTranscribing || editor.isGeneratingSoap}
                  />
                )}

                {(editor.transcript.length > 0 || editor.isRecording || editor.streamingDraft) && (
                  <div className="flex flex-col space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                        Hội thoại phiên khám
                        {editor.isWsStreaming && editor.isRecording && (
                          <span className="ml-2 normal-case font-semibold text-primary">· realtime</span>
                        )}
                      </span>
                      {!editor.isRecording && (
                        <button
                          type="button"
                          className={`text-xs font-semibold transition-colors ${
                            editor.isEditingTranscript ? 'text-emerald-700 hover:text-emerald-800' : 'text-primary hover:text-primary/80'
                          }`}
                          onClick={() => editor.setIsEditingTranscript(!editor.isEditingTranscript)}
                        >
                          {editor.isEditingTranscript ? 'Xem' : 'Hiệu chỉnh'}
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto space-y-2.5 scrollbar-thin text-[13px] max-h-[360px] pr-0.5">
                      {editor.isRecording && editor.transcript.length === 0 && !editor.streamingDraft && !editor.isLiveTranscribing && (
                        <p className="text-center text-muted-foreground py-8 leading-relaxed">
                          🎙 Đang lắng nghe…
                          <br />
                          <span className="text-[11px]">Nói ngay — chữ sẽ hiện dần theo giọng nói của bạn.</span>
                        </p>
                      )}
                      {editor.isRecording && editor.isLiveTranscribing && editor.transcript.length === 0 && (
                        <p className="text-center text-muted-foreground py-8 leading-relaxed">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                          Đang nhận diện giọng nói lần đầu…
                        </p>
                      )}
                      {editor.transcript.map((line, idx) => {
                        const isDoctor = line.speaker === 'doctor';
                        return (
                          <div
                            key={idx}
                            className={`group/line flex flex-col gap-1 ${isDoctor ? 'items-end' : 'items-start'}`}
                          >
                            <span className={`text-[10.5px] font-semibold uppercase tracking-[0.05em] ${isDoctor ? 'text-primary' : 'text-muted-foreground'}`}>
                              {isDoctor ? 'Bác sĩ' : 'Bệnh nhân'}
                            </span>
                            <div className={`flex w-full items-center gap-1.5 ${isDoctor ? 'flex-row-reverse' : 'flex-row'}`}>
                              {editor.isEditingTranscript ? (
                                <Textarea
                                  value={line.text}
                                  onChange={(e) => editor.updateTranscriptLine(idx, e.target.value)}
                                  className="text-xs min-h-[48px] flex-1"
                                />
                              ) : (
                                <p className={`max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3 py-2 leading-relaxed text-foreground ${
                                  isDoctor ? 'bg-primary/[0.07]' : 'bg-muted'
                                }`}>
                                  {line.text}
                                </p>
                              )}
                              {!editor.isRecording && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Xóa dòng hội thoại"
                                  className="h-6 w-6 shrink-0 rounded-md text-muted-foreground opacity-60 transition-colors group-hover/line:opacity-100 focus-visible:opacity-100 hover:!bg-primary hover:!text-white"
                                  onClick={() => void editor.removeTranscriptLine(idx)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {editor.streamingDraft && (
                        <div className={`flex flex-col gap-1 opacity-80 ${editor.streamingDraft.speaker === 'doctor' ? 'items-end' : 'items-start'}`}>
                          <span className={`text-[10.5px] font-semibold uppercase tracking-[0.05em] ${editor.streamingDraft.speaker === 'doctor' ? 'text-primary' : 'text-muted-foreground'}`}>
                            {editor.streamingDraft.speaker === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'} · đang nghe...
                          </span>
                          <p className="max-w-[85%] rounded-[10px] border border-dashed border-primary/30 bg-primary/5 px-3 py-2 italic animate-pulse motion-reduce:animate-none">
                            {editor.streamingDraft.text}
                          </p>
                        </div>
                      )}
                    </div>

                    {editor.isEditingTranscript && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => void editor.saveTranscriptEdit()}
                      >
                        Lưu bản hiệu chỉnh transcript
                      </Button>
                    )}

                    {!editor.isRecording && (
                      <Button
                        onClick={() => setShowRegenerateConfirm(true)}
                        disabled={editor.isGeneratingSoap || editor.isTranscribing}
                        variant="outline"
                        className="w-full h-[38px] mt-1 gap-1.5 rounded-[9px] border-primary/25 bg-primary/5 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        {editor.isGeneratingSoap ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Tạo lại SOAP bằng AI LLM
                      </Button>
                    )}
                  </div>
                )}

                {!editor.isRecording && (
                  <div className="space-y-1.5 border-t pt-3">
                    <p className="text-xs font-semibold text-foreground/80">Nhập transcript thủ công</p>
                    <div
                      role="radiogroup"
                      aria-label="Người nói"
                      className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-[3px]"
                    >
                      {(['doctor', 'patient'] as const).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          role="radio"
                          aria-checked={manualSpeaker === sp}
                          onClick={() => setManualSpeaker(sp)}
                          className={`h-[26px] rounded-md text-xs font-semibold transition-colors ${
                            manualSpeaker === sp
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {sp === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={manualLine}
                      onChange={(e) => setManualLine(e.target.value)}
                      placeholder="Nhập nội dung hội thoại..."
                      rows={3}
                      className="text-xs bg-muted/40"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-[34px] rounded-lg font-semibold transition-colors hover:!bg-primary hover:!text-white hover:!border-primary"
                      onClick={() => {
                        if (!manualLine.trim()) return;
                        editor.addManualTranscriptLine(manualSpeaker, manualLine);
                        setManualLine('');
                      }}
                    >
                      Thêm dòng hội thoại
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: AI ICD Suggestions */}
              <TabsContent value="ai" className="mt-0 p-3 outline-none">
                <AiIcdPanel
                  suggestions={editor.aiSuggestions}
                  existingIcds={editor.exam?.icd_codes ?? []}
                  loading={editor.aiLoading}
                  onConfirm={(s) => void editor.addIcdCode(s.icd_code, s.icd_name)}
                  onConfirmExisting={(icd) => void editor.confirmIcd(icd)}
                  onReject={(icd) => void editor.rejectIcd(icd)}
                />
              </TabsContent>

              {/* Tab 3: Search ICD database */}
              <TabsContent value="search" className="mt-0 p-3 outline-none">
                <IcdSearchPanel
                  search={editor.icdSearch}
                  results={editor.icdSearchResults}
                  loading={editor.icdSearchLoading}
                  existingCodes={editor.exam?.icd_codes.map((c) => c.icd_code) ?? []}
                  onSearch={editor.setIcdSearch}
                  onAdd={(code, name) => void editor.addIcdCode(code, name, true)}
                />
              </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DoctorSignOffDialog
        open={showSignOff}
        onClose={() => setShowSignOff(false)}
        onSign={async (pin, ack) => {
          const error = await editor.sign({ pin, responsibilityAck: ack });
          if (!error) setShowSignOff(false);
          return error;
        }}
        confirmedIcds={confirmedIcds}
        exam={editor.exam}
        pinLocked={isDoctorPinLocked(editor.pinLockedUntil)}
      />

      <SetupPinDialog
        open={showSetupPin}
        onClose={() => setShowSetupPin(false)}
        onSetup={async (pin) => {
          const ok = await editor.setupPin(pin);
          if (ok) {
            setShowSetupPin(false);
            setShowSignOff(true);
          }
          return ok;
        }}
      />

      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tạo lại SOAP bằng AI?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này sẽ ghi đè nội dung SOAP nháp hiện tại bằng bản mới do AI sinh ra từ transcript.
              Bạn có chắc muốn tiếp tục?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => void editor.generateSoap(editor.transcript)}>
              Xác nhận ghi đè
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExpandableSection({
  title, meta, expanded, onToggle, children,
}: {
  title: string;
  meta?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left rounded-xl transition-colors hover:bg-muted/40"
      >
        <span className="text-[13.5px] font-semibold text-foreground">{title}</span>
        {meta}
        <span className="flex-1" />
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  );
}

const SOAP_TONE = {
  rose: { badge: 'bg-primary/10 text-primary', label: 'text-primary' },
  blue: { badge: 'bg-blue-50 text-blue-700', label: 'text-blue-700' },
  amber: { badge: 'bg-amber-50 text-amber-700', label: 'text-amber-700' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700', label: 'text-emerald-700' },
} as const;

function SoapSection({
  letter, label, tone, description, required, value, onChange, locked, isAiSuggested, placeholder, toolLabel, onTool, rows = 5,
}: {
  letter: string;
  label: string;
  tone: keyof typeof SOAP_TONE;
  description: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  isAiSuggested?: boolean;
  placeholder: string;
  toolLabel?: string;
  onTool?: () => void;
  rows?: number;
}) {
  const colors = SOAP_TONE[tone];
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-bold ${colors.badge}`}>
          {letter}
        </span>
        <span className={`text-sm font-bold uppercase tracking-[0.02em] ${colors.label}`}>
          {label}
          {required && <span className="text-primary"> *</span>}
        </span>
        <span className="text-xs text-muted-foreground hidden md:inline">{description}</span>
        {isAiSuggested && !locked && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
            <Sparkles className="h-2.5 w-2.5" /> AI tạo · cần kiểm tra
          </span>
        )}
        <span className="flex-1" />
        {toolLabel && onTool && !locked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onTool}
            className="h-[26px] px-2.5 text-[11.5px] font-normal"
          >
            {toolLabel}
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={locked ? '—' : placeholder}
        rows={rows}
        disabled={locked}
        className={`resize-y min-h-[112px] rounded-[9px] text-sm leading-relaxed focus-visible:ring-primary ${
          locked
            ? 'bg-muted/60 cursor-default text-foreground/80'
            : isAiSuggested
            ? 'bg-amber-50/40 border-amber-200'
            : 'bg-muted/30'
        }`}
      />
      {!locked && (
        <div className="flex justify-end text-[11px] text-muted-foreground">{value.length} ký tự</div>
      )}
    </div>
  );
}

function ConfirmedIcdBadge({
  icd, onRemove,
}: {
  icd: SoapIcdCode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex h-[30px] max-w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 pl-2.5 pr-1 text-[13px]">
      <span className="font-mono font-semibold text-emerald-700">{icd.icd_code}</span>
      <span className="truncate text-foreground">{icd.icd_name}</span>
      {icd.is_ai_suggested && (
        <span title="Được gợi ý bởi AI" className="text-amber-500">
          <Sparkles className="h-3 w-3" />
        </span>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="grid h-[22px] w-[22px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-primary"
          title="Xóa chẩn đoán"
          aria-label={`Xóa chẩn đoán ${icd.icd_code}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </span>
  );
}

function AiIcdPanel({
  suggestions, existingIcds, loading, onConfirm, onConfirmExisting, onReject,
}: {
  suggestions: AiIcdSuggestion[];
  existingIcds: SoapIcdCode[];
  loading: boolean;
  onConfirm: (s: AiIcdSuggestion) => void;
  onConfirmExisting: (icd: SoapIcdCode) => void;
  onReject: (icd: SoapIcdCode) => void;
}) {
  const pendingExisting = existingIcds.filter((c) => c.confirm_status === 'PENDING');
  const rejectedExisting = existingIcds.filter((c) => c.confirm_status === 'REJECTED');

  const sortedItems = [
    ...pendingExisting.map((icd) => ({
      kind: 'pending' as const,
      key: icd.id,
      code: icd.icd_code,
      name: icd.icd_name,
      confidence: icd.ai_confidence ?? 0,
      reason: icd.ai_reason,
      icd,
    })),
    ...suggestions
      .filter((s) => !existingIcds.some((e) => e.icd_code === s.icd_code))
      .map((s) => ({
        kind: 'new' as const,
        key: s.icd_code,
        code: s.icd_code,
        name: s.icd_name,
        confidence: s.confidence ?? 0,
        reason: s.reason,
        suggestion: s,
      })),
  ].sort((a, b) => b.confidence - a.confidence);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        AI đang phân tích triệu chứng...
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="text-center px-2 py-6 space-y-2">
        <Brain className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nhập nội dung vào phần S và O hoặc sử dụng trợ lý ghi âm để AI tự động phân tích gợi ý chẩn đoán.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 w-full">
      {sortedItems.map((item) => (
        <IcdSuggestionCard
          key={item.key}
          code={item.code}
          name={item.name}
          confidence={item.confidence}
          reason={item.reason}
          onConfirm={() =>
            item.kind === 'pending'
              ? onConfirmExisting(item.icd)
              : onConfirm(item.suggestion)
          }
          onReject={
            item.kind === 'pending'
              ? () => onReject(item.icd)
              : undefined
          }
        />
      ))}

      {rejectedExisting.length > 0 && (
        <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
          Đã bỏ qua {rejectedExisting.length} gợi ý của AI
        </p>
      )}
    </div>
  );
}

function IcdSuggestionCard({
  code, name, confidence, reason, onConfirm, onReject,
}: {
  code: string;
  name: string;
  confidence?: number | null;
  reason?: string | null;
  onConfirm: () => void;
  onReject?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-emerald-700">{code}</span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{name}</span>
        {confidence != null && (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            {confidence}%
          </span>
        )}
      </div>

      {confidence != null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-violet-600" style={{ width: `${confidence}%` }} />
        </div>
      )}

      {reason && (
        <p className="text-xs leading-snug text-muted-foreground">Dựa trên: {reason}</p>
      )}

      <div className="flex justify-end gap-1.5">
        {onReject && (
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-muted-foreground" onClick={onReject}>
            Bỏ qua
          </Button>
        )}
        <Button size="sm" className="h-7 px-3 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800" onClick={onConfirm}>
          <Check className="h-3 w-3 mr-1" /> Xác nhận thêm
        </Button>
      </div>
    </div>
  );
}
