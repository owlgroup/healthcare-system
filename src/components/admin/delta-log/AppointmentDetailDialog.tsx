import { useEffect, useState } from 'react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2, Heart, Stethoscope, FileText, Pill, ArrowLeft, Activity, History,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import {
  getExaminationVersionHistory,
  listExaminationActivityLog,
  type ExamVersionHistoryEntry,
} from '@/lib/emr-api';
import { activityLogsToVersionHistory } from '@/lib/exam-activity-log';
import type { SoapIcdCode } from '@/types/emr';
import ExamVersionHistoryTable from './ExamVersionHistoryTable';
import SoapVersionDiff from './SoapVersionDiff';

type MedicalHistoryItem = string | { condition?: string; details?: string };
type MedicationItem = string | { name?: string; dose?: string; frequency?: string };

type AppointmentDetail = {
  id: string;
  scheduled_time: string;
  status: string;
  patient: {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    phone: string | null;
  } | null;
  doctor: {
    full_name: string | null;
    specialty_name: string | null;
  } | null;
  vitals: {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    heart_rate: number | null;
    temperature_c: number | null;
    respiratory_rate: number | null;
    spo2: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    clinical_note: string | null;
  } | null;
  pre_consultation: {
    chief_complaint: string | null;
    duration: string | null;
    associated_symptoms: string[] | null;
    medical_history: MedicalHistoryItem[] | null;
    current_medications: string | MedicationItem[] | null;
  } | null;
  examination: {
    id: string;
    s_text: string | null;
    o_text: string | null;
    a_text: string | null;
    p_text: string | null;
    status: string;
    icd_codes: SoapIcdCode[];
  } | null;
};

async function safeDecrypt(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch {
    return value;
  }
}

function formatMedicalHistory(item: MedicalHistoryItem): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const parts: string[] = [];
    if (item.condition) parts.push(item.condition);
    if (item.details) parts.push(item.details);
    return parts.join(' - ') || '—';
  }
  return '—';
}

function formatMedication(item: MedicationItem): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const parts: string[] = [];
    if (item.name) parts.push(item.name);
    if (item.dose) parts.push(item.dose);
    if (item.frequency) parts.push(`(${item.frequency})`);
    return parts.join(' ') || '—';
  }
  return '—';
}

type Props = {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AppointmentDetailDialog({ appointmentId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AppointmentDetail | null>(null);
  const [versions, setVersions] = useState<ExamVersionHistoryEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('versions');

  useEffect(() => {
    if (!open || !appointmentId) {
      setData(null);
      setVersions([]);
      setSelectedVersion(null);
      setVersionsError(null);
      setShowOnlyChanges(false);
      setActiveTab('versions');
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: appt, error } = await supabase
          .from('appointments')
          .select(`
            id,
            status,
            created_at,
            patient:profile_id (
              id,
              legal_first_name,
              legal_last_name,
              date_of_birth,
              phone_number
            ),
            specialties (
              name
            ),
            appointment_slots (
              slot_date,
              start_time,
              end_time,
              doctor_id,
              user_profiles!appointment_slots_doctor_id_fkey (
                full_name
              )
            )
          `)
          .eq('id', appointmentId)
          .single();

        if (error || !appt) {
          if (!cancelled) setData(null);
          return;
        }

        const pt = appt.patient as { id: string; legal_first_name: string | null; legal_last_name: string | null; date_of_birth: string | null; phone_number: string | null } | null;
        const sp = appt.specialties as { name: string } | null;
        const sl = appt.appointment_slots as { slot_date: string; start_time: string; end_time: string; doctor_id: string | null; user_profiles: { full_name: string } | null } | null;

        const patientName = pt ? [pt.legal_last_name, pt.legal_first_name].filter(Boolean).join(' ') : null;
        const scheduledTime = sl?.slot_date && sl?.start_time
          ? `${sl.slot_date}T${sl.start_time}`
          : appt.created_at;

        const { data: vitals } = await supabase
          .from('vital_signs')
          .select('*')
          .eq('appointment_id', appointmentId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: preConsult } = await supabase
          .from('pre_consultations')
          .select('*')
          .eq('appointment_id', appointmentId)
          .maybeSingle();

        const { data: exam } = await supabase
          .from('medical_examinations')
          .select('id, s_text, o_text, a_text, p_text, status')
          .eq('appointment_id', appointmentId)
          .eq('is_addendum', false)
          .maybeSingle();

        let icdCodes: SoapIcdCode[] = [];
        if (exam?.id) {
          const { data: icds } = await supabase
            .from('soap_icd_codes')
            .select('*')
            .eq('exam_id', exam.id);
          if (icds) {
            icdCodes = icds.map((row) => ({
              id: String(row.id),
              exam_id: String(row.exam_id),
              icd_code: String(row.icd_code),
              icd_name: String(row.icd_name),
              is_ai_suggested: Boolean(row.is_ai_suggested),
              ai_confidence: row.ai_confidence != null ? Number(row.ai_confidence) : null,
              ai_reason: row.ai_reason != null ? String(row.ai_reason) : null,
              confirm_status: row.confirm_status as SoapIcdCode['confirm_status'],
              confirmed_at: row.confirmed_at != null ? String(row.confirmed_at) : null,
              display_order: Number(row.display_order ?? 0),
              created_at: String(row.created_at),
            }));
          }
        }

        const [
          decryptedPhone,
          decryptedChiefComplaint,
          decryptedSText,
          decryptedOText,
          decryptedAText,
          decryptedPText,
        ] = await Promise.all([
          safeDecrypt(pt?.phone_number ?? null),
          safeDecrypt(preConsult?.chief_complaint ?? null),
          safeDecrypt(exam?.s_text ?? null),
          safeDecrypt(exam?.o_text ?? null),
          safeDecrypt(exam?.a_text ?? null),
          safeDecrypt(exam?.p_text ?? null),
        ]);

        if (!cancelled) {
          setData({
            id: appt.id,
            scheduled_time: scheduledTime,
            status: appt.status as string,
            patient: pt ? {
              id: pt.id,
              full_name: patientName,
              date_of_birth: pt.date_of_birth,
              phone: decryptedPhone,
            } : null,
            doctor: {
              full_name: sl?.user_profiles?.full_name ?? null,
              specialty_name: sp?.name ?? null,
            },
            vitals: vitals ? {
              bp_systolic: vitals.bp_systolic,
              bp_diastolic: vitals.bp_diastolic,
              heart_rate: vitals.heart_rate,
              temperature_c: vitals.temperature_c,
              respiratory_rate: vitals.respiratory_rate,
              spo2: vitals.spo2,
              weight_kg: vitals.weight_kg,
              height_cm: vitals.height_cm,
              clinical_note: vitals.clinical_note,
            } : null,
            pre_consultation: preConsult ? {
              chief_complaint: decryptedChiefComplaint,
              duration: preConsult.duration,
              associated_symptoms: preConsult.associated_symptoms,
              medical_history: preConsult.medical_history,
              current_medications: preConsult.current_medications,
            } : null,
            examination: exam ? {
              id: exam.id,
              s_text: decryptedSText,
              o_text: decryptedOText,
              a_text: decryptedAText,
              p_text: decryptedPText,
              status: exam.status,
              icd_codes: icdCodes,
            } : null,
          });

          if (exam?.id) {
            setVersionsLoading(true);
            setVersionsError(null);
            try {
              let versionHistory = await getExaminationVersionHistory(exam.id);

              if (versionHistory.length === 0) {
                const activityLogs = await listExaminationActivityLog(exam.id);
                versionHistory = activityLogsToVersionHistory(activityLogs);
              }

              if (!cancelled) {
                setVersions(versionHistory);
                if (versionHistory.length > 0) {
                  setSelectedVersion(versionHistory[0].version);
                }
              }
            } catch (err) {
              if (!cancelled) {
                const message = err instanceof Error
                  ? err.message
                  : 'Không tải được lịch sử phiên bản.';
                setVersions([]);
                setSelectedVersion(null);
                setVersionsError(message);
                toast.error(message);
              }
            } finally {
              if (!cancelled) setVersionsLoading(false);
            }
          }
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, appointmentId]);

  const patientAge = data?.patient?.date_of_birth
    ? differenceInYears(new Date(), parseISO(data.patient.date_of_birth))
    : null;

  const bmi = data?.vitals?.weight_kg && data?.vitals?.height_cm
    ? (data.vitals.weight_kg / Math.pow(data.vitals.height_cm / 100, 2)).toFixed(1)
    : null;

  const selectedVersionData = versions.find((v) => v.version === selectedVersion);
  const previousVersionData = selectedVersion && selectedVersion > 1
    ? versions.find((v) => v.version === selectedVersion - 1)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-muted-foreground">
            Không tìm thấy thông tin lịch hẹn.
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header */}
            <DialogHeader className="p-4 pr-12 border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <DialogTitle className="text-lg font-bold whitespace-nowrap">
                      Khám bệnh — {data.patient?.full_name ?? 'N/A'}
                    </DialogTitle>
                    {data.examination?.status === 'signed' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                        Đã hoàn thành
                      </span>
                    )}
                  </div>
                </div>
                {data.doctor?.full_name && (
                  <div className="flex items-center gap-2 bg-white rounded-2xl border-2 border-border pl-1 pr-3 py-1 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      BS
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-foreground whitespace-nowrap">ThS. BS {data.doctor.full_name}</p>
                      <p className="text-muted-foreground whitespace-nowrap">
                        Chuyên khoa {data.doctor.specialty_name ?? 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Tabs */}
            <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 mb-4 h-12 p-1 bg-white border-2 border-border rounded-lg">
                  <TabsTrigger
                    value="versions"
                    className="flex items-center gap-2 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                  >
                    <History className="h-4 w-4" />
                    Lịch sử phiên bản
                  </TabsTrigger>
                  <TabsTrigger
                    value="vitals"
                    className="flex items-center gap-2 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                  >
                    <Heart className="h-4 w-4" />
                    Sinh hiệu
                  </TabsTrigger>
                  <TabsTrigger
                    value="pre-consult"
                    className="flex items-center gap-2 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                  >
                    <FileText className="h-4 w-4" />
                    Khai báo y tế
                  </TabsTrigger>
                </TabsList>

                <div>

                {/* Vital Signs Tab */}
                <TabsContent value="vitals">
                  {data.vitals ? (
                    <div className="space-y-4">
                      {/* Vitals Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Blood Pressure Card */}
                        <div className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2m6-2a8 8 0 11-16 0 8 8 0 0116 0z" />
                                </svg>
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Huyết áp (BP)</h3>
                                <p className="text-[11px] text-muted-foreground">Tâm thu / Tâm trương</p>
                              </div>
                            </div>
                            {data.vitals.bp_systolic != null && data.vitals.bp_systolic <= 120 && data.vitals.bp_diastolic != null && data.vitals.bp_diastolic <= 80 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Bình thường
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Cần theo dõi
                              </span>
                            )}
                          </div>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-3xl font-extrabold tracking-tight text-foreground">{data.vitals.bp_systolic ?? '—'}</span>
                              <span className="text-xl font-light text-muted-foreground">/</span>
                              <span className="text-2xl font-bold text-muted-foreground">{data.vitals.bp_diastolic ?? '—'}</span>
                              <span className="text-xs text-muted-foreground font-medium ml-1">mmHg</span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                              <span>Tâm thu: <strong className="text-foreground">{data.vitals.bp_systolic ?? '—'}</strong></span>
                              <span>Tâm trương: <strong className="text-foreground">{data.vitals.bp_diastolic ?? '—'}</strong></span>
                            </div>
                          </div>
                          <div className="space-y-1 pt-2 border-t border-border">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Chuẩn: 90/60 - 120/80</span>
                              <span className="font-medium text-emerald-600">Lý tưởng</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="bg-emerald-400 h-full w-2/3 rounded-full" />
                            </div>
                          </div>
                        </div>

                        {/* Heart Rate Card */}
                        <div className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-red-50 text-rose-500 flex items-center justify-center">
                                <Heart className="w-5 h-5" fill="currentColor" />
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Nhịp tim (Pulse)</h3>
                                <p className="text-[11px] text-muted-foreground">Tần số tim nghỉ ngơi</p>
                              </div>
                            </div>
                            {data.vitals.heart_rate != null && data.vitals.heart_rate >= 60 && data.vitals.heart_rate <= 100 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Ổn định
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Bất thường
                              </span>
                            )}
                          </div>
                          <div className="mb-3 flex items-end justify-between">
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-extrabold tracking-tight text-foreground">{data.vitals.heart_rate ?? '—'}</span>
                                <span className="text-xs text-muted-foreground font-medium">bpm</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Khoảng chuẩn: 60 - 100 bpm</p>
                            </div>
                            <div className="w-24 h-10 opacity-70">
                              <svg className="w-full h-full stroke-rose-500 fill-none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 100 40">
                                <path d="M0 20 L20 20 L25 10 L30 32 L37 5 L43 28 L47 20 L60 20 L65 14 L70 24 L74 20 L100 20" />
                              </svg>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Nhịp đều, rõ ràng</span>
                            <span className="text-emerald-600 font-semibold">T1, T2 bình thường</span>
                          </div>
                        </div>

                        {/* SpO2 Card */}
                        <div className={`rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${
                          data.vitals.spo2 != null && data.vitals.spo2 < 95
                            ? 'bg-gradient-to-b from-red-50/50 to-white border-2 border-red-300'
                            : 'bg-white border border-border'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                data.vitals.spo2 != null && data.vitals.spo2 < 95 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-500'
                              }`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Bão hòa Oxy (SpO2)</h3>
                                <p className="text-[11px] text-muted-foreground">Đo qua đầu ngón tay</p>
                              </div>
                            </div>
                            {data.vitals.spo2 != null && data.vitals.spo2 < 95 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full animate-pulse">
                                <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Báo động thấp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Bình thường
                              </span>
                            )}
                          </div>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className={`text-4xl font-black tracking-tight ${data.vitals.spo2 != null && data.vitals.spo2 < 95 ? 'text-red-600' : 'text-foreground'}`}>
                                {data.vitals.spo2 ?? '—'}
                              </span>
                              <span className={`text-lg font-bold ${data.vitals.spo2 != null && data.vitals.spo2 < 95 ? 'text-red-500' : 'text-muted-foreground'}`}>%</span>
                              {data.vitals.spo2 != null && data.vitals.spo2 < 95 && (
                                <span className="ml-2 text-xs font-semibold text-red-600 bg-red-100/70 px-2 py-0.5 rounded">Nguy cơ thiếu oxy</span>
                              )}
                            </div>
                            <p className={`text-xs mt-1 font-medium ${data.vitals.spo2 != null && data.vitals.spo2 < 95 ? 'text-red-700' : 'text-muted-foreground'}`}>
                              Mức bình thường: ≥ 95%
                            </p>
                          </div>
                          <div className="space-y-1.5 pt-2 border-t border-border">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
                              <div className="h-full w-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className={data.vitals.spo2 != null && data.vitals.spo2 < 95 ? 'text-red-700 font-bold' : ''}>
                                Hiện tại: {data.vitals.spo2 ?? '—'}% {data.vitals.spo2 != null && data.vitals.spo2 < 95 ? '(Nguy hiểm)' : ''}
                              </span>
                              <span>≥ 95% (Chuẩn)</span>
                            </div>
                          </div>
                        </div>

                        {/* Temperature Card */}
                        <div className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a3 3 0 016 0v6a3 3 0 01-6 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v10" />
                                </svg>
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Thân nhiệt</h3>
                                <p className="text-[11px] text-muted-foreground">Đo trán / màng nhĩ</p>
                              </div>
                            </div>
                            {data.vitals.temperature_c != null && data.vitals.temperature_c >= 36.1 && data.vitals.temperature_c <= 37.2 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Thân nhiệt chuẩn
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Bất thường
                              </span>
                            )}
                          </div>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-extrabold tracking-tight text-foreground">{data.vitals.temperature_c ?? '—'}</span>
                              <span className="text-sm font-semibold text-muted-foreground">°C</span>
                              {data.vitals.temperature_c != null && (
                                <span className="text-xs text-muted-foreground ml-1">({((data.vitals.temperature_c * 9/5) + 32).toFixed(1)} °F)</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Không sốt, không hạ thân nhiệt</p>
                          </div>
                          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Ngưỡng chuẩn: 36.1 - 37.2 °C</span>
                            <span className="text-emerald-600 font-medium">Bình thường</span>
                          </div>
                        </div>

                        {/* Respiratory Rate Card */}
                        <div className={`rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${
                          data.vitals.respiratory_rate != null && (data.vitals.respiratory_rate < 12 || data.vitals.respiratory_rate > 20)
                            ? 'bg-white border border-amber-200'
                            : 'bg-white border border-border'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-teal-50 text-teal-500 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Nhịp thở (RR)</h3>
                                <p className="text-[11px] text-muted-foreground">Tần số hô hấp</p>
                              </div>
                            </div>
                            {data.vitals.respiratory_rate != null && data.vitals.respiratory_rate > 20 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Thở nhanh (Tachypnea)
                              </span>
                            ) : data.vitals.respiratory_rate != null && data.vitals.respiratory_rate < 12 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Thở chậm
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Bình thường
                              </span>
                            )}
                          </div>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className={`text-3xl font-extrabold tracking-tight ${
                                data.vitals.respiratory_rate != null && (data.vitals.respiratory_rate < 12 || data.vitals.respiratory_rate > 20)
                                  ? 'text-amber-700'
                                  : 'text-foreground'
                              }`}>{data.vitals.respiratory_rate ?? '—'}</span>
                              <span className="text-xs font-semibold text-muted-foreground">lần/phút</span>
                            </div>
                            <p className={`text-xs mt-1 font-medium ${
                              data.vitals.respiratory_rate != null && (data.vitals.respiratory_rate < 12 || data.vitals.respiratory_rate > 20)
                                ? 'text-amber-700'
                                : 'text-muted-foreground'
                            }`}>
                              {data.vitals.respiratory_rate != null && data.vitals.respiratory_rate > 20
                                ? 'Cao hơn giới hạn thông thường (12-20 l/ph)'
                                : 'Khoảng chuẩn: 12-20 l/ph'}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Kiểu thở: {data.vitals.respiratory_rate != null && data.vitals.respiratory_rate > 20 ? 'Nhanh nông' : 'Bình thường'}</span>
                            <span className={data.vitals.respiratory_rate != null && data.vitals.respiratory_rate > 20 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                              {data.vitals.respiratory_rate != null && data.vitals.respiratory_rate > 20 ? 'Theo dõi gắng sức' : 'Ổn định'}
                            </span>
                          </div>
                        </div>

                        {/* BMI Card */}
                        <div className={`rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${
                          bmi != null && parseFloat(bmi) >= 25
                            ? 'bg-white border border-rose-200'
                            : 'bg-white border border-border'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                </svg>
                              </span>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">Thể trạng & Chỉ số BMI</h3>
                                <p className="text-[11px] text-muted-foreground">Chiều cao & Cân nặng</p>
                              </div>
                            </div>
                            {bmi != null && parseFloat(bmi) >= 30 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                Béo phì độ {parseFloat(bmi) >= 35 ? 'III' : parseFloat(bmi) >= 30 ? 'II' : 'I'}
                              </span>
                            ) : bmi != null && parseFloat(bmi) >= 25 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Thừa cân
                              </span>
                            ) : bmi != null && parseFloat(bmi) < 18.5 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                Thiếu cân
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Bình thường
                              </span>
                            )}
                          </div>
                          <div className="mb-3 grid grid-cols-3 gap-2 bg-muted/50 p-2.5 rounded-lg border border-border text-center">
                            <div>
                              <span className="block text-[11px] text-muted-foreground">Cân nặng</span>
                              <span className="text-base font-black text-foreground">{data.vitals.weight_kg ?? '—'} <small className="font-normal text-[11px]">kg</small></span>
                            </div>
                            <div className="border-x border-border">
                              <span className="block text-[11px] text-muted-foreground">Chiều cao</span>
                              <span className="text-base font-black text-foreground">{data.vitals.height_cm ?? '—'} <small className="font-normal text-[11px]">cm</small></span>
                            </div>
                            <div>
                              <span className={`block text-[11px] font-semibold ${bmi != null && parseFloat(bmi) >= 25 ? 'text-rose-600' : 'text-muted-foreground'}`}>BMI</span>
                              <span className={`text-base font-black ${bmi != null && parseFloat(bmi) >= 25 ? 'text-rose-700' : 'text-foreground'}`}>{bmi ?? '—'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                              <div className="w-1/4 bg-blue-300" title="Gầy (<18.5)" />
                              <div className="w-1/4 bg-emerald-400" title="Bình thường (18.5-22.9)" />
                              <div className="w-1/4 bg-amber-400" title="Tiền béo phì (23-24.9)" />
                              <div className="w-1/4 bg-rose-500" title="Béo phì (>=25)" />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Bình thường: 18.5-22.9</span>
                              <span className={bmi != null && parseFloat(bmi) >= 25 ? 'font-bold text-rose-600' : ''}>
                                BMI: {bmi ?? '—'} (Châu Á)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clinical Notes Section */}
                      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-muted text-muted-foreground rounded-md">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Ghi chú lâm sàng & Nhận xét điều dưỡng</h3>
                          </div>
                          <div className="flex items-center flex-wrap gap-1.5 text-xs">
                            <span className="text-muted-foreground text-[11px] mr-1">Chèn nhanh:</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px]">Bệnh nhân tỉnh táo</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px]">Có khó thở nhẹ</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">Đã kiểm tra lại SpO2</span>
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-4 text-sm border border-border">
                          {data.vitals.clinical_note || <span className="text-muted-foreground italic">Không có ghi chú lâm sàng</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu sinh hiệu.</p>
                  )}
                </TabsContent>

                {/* Pre-consultation Tab */}
                <TabsContent value="pre-consult">
                  {data.pre_consultation ? (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Chief Complaint */}
                      <div className="bg-red-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Stethoscope className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-semibold text-red-600 uppercase">Triệu chứng chính</span>
                        </div>
                        <p className="font-medium">{data.pre_consultation.chief_complaint ?? '—'}</p>
                        {data.pre_consultation.duration && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Thời gian: {data.pre_consultation.duration}
                          </p>
                        )}
                        {data.pre_consultation.associated_symptoms && data.pre_consultation.associated_symptoms.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground">Đi kèm:</span>
                            {data.pre_consultation.associated_symptoms.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white rounded text-xs border">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Medical History & Medications */}
                      <div className="space-y-3">
                        {data.pre_consultation.medical_history && data.pre_consultation.medical_history.length > 0 && (
                          <div className="bg-blue-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-4 w-4 text-blue-500" />
                              <span className="text-xs font-semibold text-blue-600 uppercase">Bệnh sử</span>
                            </div>
                            <ul className="text-sm space-y-1">
                              {data.pre_consultation.medical_history.map((h, i) => (
                                <li key={i}>• {formatMedicalHistory(h)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="bg-green-50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="h-4 w-4 text-green-500" />
                            <span className="text-xs font-semibold text-green-600 uppercase">Thuốc đang dùng</span>
                          </div>
                          {(() => {
                            const meds = data.pre_consultation.current_medications;
                            if (!meds) {
                              return <p className="text-sm text-green-600 italic">Không dùng thuốc</p>;
                            }
                            if (typeof meds === 'string') {
                              return <p className="text-sm">{meds}</p>;
                            }
                            if (Array.isArray(meds) && meds.length > 0) {
                              return (
                                <ul className="text-sm space-y-1">
                                  {meds.map((m, i) => (
                                    <li key={i}>• {formatMedication(m)}</li>
                                  ))}
                                </ul>
                              );
                            }
                            return <p className="text-sm text-green-600 italic">Không dùng thuốc</p>;
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu khai báo y tế.</p>
                  )}
                </TabsContent>

                {/* Version History Tab */}
                <TabsContent value="versions" className="space-y-6">
                  {data.examination ? (
                    versionsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : versions.length > 0 ? (
                      <>
                        <ExamVersionHistoryTable
                          versions={versions}
                          selectedVersion={selectedVersion}
                          onSelectVersion={setSelectedVersion}
                        />

                        {selectedVersionData && (
                          <SoapVersionDiff
                            currentVersion={selectedVersionData}
                            previousVersion={previousVersionData}
                            icdCodes={data.examination.icd_codes}
                            showOnlyChanges={showOnlyChanges}
                            onToggleShowOnlyChanges={setShowOnlyChanges}
                            currentSoapFallback={{
                              s_text: data.examination.s_text,
                              o_text: data.examination.o_text,
                              a_text: data.examination.a_text,
                              p_text: data.examination.p_text,
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        {versionsError && (
                          <p className="text-sm text-destructive">
                            {versionsError} Đang hiển thị ghi chú hiện tại.
                          </p>
                        )}
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">Ghi chú lâm sàng</h3>
                        </div>
                        {data.examination.s_text && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 uppercase mb-1">
                              Lời khai bệnh nhân <span className="font-normal text-muted-foreground">Triệu chứng, bệnh sử, lý do</span>
                            </p>
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              {data.examination.s_text}
                            </div>
                          </div>
                        )}
                        {data.examination.o_text && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 uppercase mb-1">
                              Kết quả khám thực thể <span className="font-normal text-muted-foreground">Sinh hiệu, đánh giá lâm sàng</span>
                            </p>
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              {data.examination.o_text}
                            </div>
                          </div>
                        )}
                        {data.examination.a_text && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 uppercase mb-1">
                              Chẩn đoán lâm sàng
                            </p>
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              {data.examination.a_text}
                            </div>
                          </div>
                        )}
                        {data.examination.p_text && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 uppercase mb-1">
                              Kế hoạch điều trị <span className="font-normal text-muted-foreground">Hướng xử trí, dặn dò</span>
                            </p>
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              {data.examination.p_text}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu khám bệnh.</p>
                  )}
                </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-background flex-shrink-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại danh sách
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
