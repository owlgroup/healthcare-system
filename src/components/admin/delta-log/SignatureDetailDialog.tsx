import { useEffect, useState } from 'react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Loader2, Heart, Stethoscope, FileText, Pill, ArrowLeft, Activity, ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import type { SignatureLogEntry } from '@/types/delta-log';

async function safeDecrypt(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch {
    return value;
  }
}

type MedicalHistoryItem = string | { condition?: string; details?: string };
type MedicationItem = string | { name?: string; dose?: string; frequency?: string };

type ExaminationDetail = {
  id: string;
  scheduled_time: string;
  patient: {
    full_name: string | null;
    date_of_birth: string | null;
    phone: string | null;
  } | null;
  doctor: {
    full_name: string | null;
    specialty_name: string | null;
  } | null;
  vitals: {
    systolic_bp: number | null;
    diastolic_bp: number | null;
    heart_rate: number | null;
    temperature: number | null;
    respiratory_rate: number | null;
    spo2: number | null;
    weight: number | null;
    height: number | null;
  } | null;
  pre_consultation: {
    chief_complaint: string | null;
    duration: string | null;
    associated_symptoms: string[] | null;
    medical_history: MedicalHistoryItem[] | null;
    current_medications: string | MedicationItem[] | null;
  } | null;
  examination: {
    s_text: string | null;
    o_text: string | null;
    a_text: string | null;
    p_text: string | null;
    status: string;
  } | null;
  signature: {
    signed_at: string;
    signed_by_name: string | null;
    data_hash: string;
  };
};

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
  entry: SignatureLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function SignatureDetailDialog({ entry, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExaminationDetail | null>(null);

  useEffect(() => {
    if (!open || !entry) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Use RPC function to bypass RLS
        const { data: result, error } = await supabase
          .rpc('get_medical_examination_detail', { p_exam_id: entry.target_id });

        if (error || !result) {
          console.error('SignatureDetailDialog: Failed to fetch exam', error);
          if (!cancelled) setData(null);
          return;
        }

        const { exam, patient, doctor, slot, vitals, pre_consultation } = result as {
          exam: { id: string; appointment_id: string; s_text: string | null; o_text: string | null; a_text: string | null; p_text: string | null; status: string } | null;
          patient: { full_name: string | null; date_of_birth: string | null; phone: string | null } | null;
          doctor: { full_name: string | null; specialty_name: string | null } | null;
          slot: { slot_date: string | null; start_time: string | null } | null;
          vitals: { systolic_bp: number | null; diastolic_bp: number | null; heart_rate: number | null; temperature: number | null; respiratory_rate: number | null; spo2: number | null; weight: number | null; height: number | null } | null;
          pre_consultation: { chief_complaint: string | null; duration: string | null; associated_symptoms: string[] | null; medical_history: MedicalHistoryItem[] | null; current_medications: string | MedicationItem[] | null } | null;
        };

        if (!exam) {
          if (!cancelled) setData(null);
          return;
        }

        const scheduledTime = slot?.slot_date && slot?.start_time
          ? `${slot.slot_date}T${slot.start_time}`
          : entry.signed_at;

        // Decrypt SOAP fields
        const [decryptedSText, decryptedOText, decryptedAText, decryptedPText] = await Promise.all([
          safeDecrypt(exam.s_text),
          safeDecrypt(exam.o_text),
          safeDecrypt(exam.a_text),
          safeDecrypt(exam.p_text),
        ]);

        if (!cancelled) {
          setData({
            id: exam.id,
            scheduled_time: scheduledTime,
            patient: patient?.full_name ? {
              full_name: patient.full_name,
              date_of_birth: patient.date_of_birth,
              phone: patient.phone,
            } : null,
            doctor: {
              full_name: doctor?.full_name ?? null,
              specialty_name: doctor?.specialty_name ?? null,
            },
            vitals: vitals,
            pre_consultation: pre_consultation,
            examination: {
              s_text: decryptedSText,
              o_text: decryptedOText,
              a_text: decryptedAText,
              p_text: decryptedPText,
              status: exam.status,
            },
            signature: {
              signed_at: entry.signed_at,
              signed_by_name: entry.signed_by_name,
              data_hash: entry.data_hash,
            },
          });
        }
      } catch (err) {
        console.error('SignatureDetailDialog error:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, entry]);

  const patientAge = data?.patient?.date_of_birth
    ? differenceInYears(new Date(), parseISO(data.patient.date_of_birth))
    : null;

  const bmi = data?.vitals?.weight && data?.vitals?.height
    ? (data.vitals.weight / Math.pow(data.vitals.height / 100, 2)).toFixed(1)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-muted-foreground">
            Không tìm thấy thông tin bệnh án.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Header */}
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold">
                      Bệnh án đã ký — {data.patient?.full_name ?? 'N/A'}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Ngày khám: {format(parseISO(data.scheduled_time), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      {patientAge && <span> • {patientAge} tuổi</span>}
                      {data.patient?.phone && <span> • {data.patient.phone}</span>}
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Signature Info */}
            <div className="px-6 py-4 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase">Thông tin chữ ký số</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Người ký: </span>
                  <span className="font-medium">{data.signature.signed_by_name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Thời gian ký: </span>
                  <span className="font-medium">
                    {format(parseISO(data.signature.signed_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </span>
                </div>
              </div>
            </div>

            {/* Doctor Info */}
            {data.doctor?.full_name && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    BS
                  </div>
                  <div>
                    <p className="font-semibold">ThS. BS {data.doctor.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Chuyên khoa {data.doctor.specialty_name ?? 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Vital Signs */}
            {data.vitals && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold text-red-600">Sinh hiệu</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {data.vitals.systolic_bp && data.vitals.diastolic_bp && (
                    <div>
                      <span className="text-muted-foreground">HA Tâm thu: </span>
                      <span className="font-medium">{data.vitals.systolic_bp} mmHg</span>
                    </div>
                  )}
                  {data.vitals.diastolic_bp && (
                    <div>
                      <span className="text-muted-foreground">HA Tâm trương: </span>
                      <span className="font-medium">{data.vitals.diastolic_bp} mmHg</span>
                    </div>
                  )}
                  {data.vitals.heart_rate && (
                    <div>
                      <span className="text-muted-foreground">Nhịp tim: </span>
                      <span className="font-medium">{data.vitals.heart_rate} bpm</span>
                    </div>
                  )}
                  {data.vitals.temperature && (
                    <div>
                      <span className="text-muted-foreground">Nhiệt độ: </span>
                      <span className="font-medium">{data.vitals.temperature} °C</span>
                    </div>
                  )}
                  {data.vitals.respiratory_rate && (
                    <div>
                      <span className="text-muted-foreground">Nhịp thở: </span>
                      <span className="font-medium">{data.vitals.respiratory_rate} l/ph</span>
                    </div>
                  )}
                  {data.vitals.spo2 && (
                    <div>
                      <span className="text-muted-foreground">SpO2: </span>
                      <span className="font-medium">{data.vitals.spo2} %</span>
                    </div>
                  )}
                  {data.vitals.weight && (
                    <div>
                      <span className="text-muted-foreground">Cân nặng: </span>
                      <span className="font-medium">{data.vitals.weight} kg</span>
                    </div>
                  )}
                  {data.vitals.height && (
                    <div>
                      <span className="text-muted-foreground">Chiều cao: </span>
                      <span className="font-medium">{data.vitals.height} cm</span>
                    </div>
                  )}
                  {bmi && (
                    <div>
                      <span className="text-muted-foreground">BMI: </span>
                      <span className="font-medium">{bmi}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pre-consultation */}
            {data.pre_consultation && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Khai báo y tế trước khám</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
              </div>
            )}

            {/* SOAP Notes */}
            {data.examination && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Ghi chú lâm sàng</h3>
                </div>
                <div className="space-y-4">
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
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4">
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
