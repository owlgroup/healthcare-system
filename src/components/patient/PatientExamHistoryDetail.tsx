import { useEffect, useState } from 'react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2, Heart, Stethoscope, FileText, Pill, ArrowLeft, ClipboardList, X, History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';

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
    s_text: string | null;
    o_text: string | null;
    a_text: string | null;
    p_text: string | null;
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
  appointmentId: string;
  onBack: () => void;
};

export default function PatientExamHistoryDetail({ appointmentId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppointmentDetail | null>(null);

  useEffect(() => {
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
          if (!cancelled) {
            toast.error('Không tìm thấy thông tin lịch khám');
            setData(null);
          }
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
              s_text: decryptedSText,
              o_text: decryptedOText,
              a_text: decryptedAText,
              p_text: decryptedPText,
            } : null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          toast.error((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [appointmentId]);

  const age = data?.patient?.date_of_birth
    ? differenceInYears(new Date(), parseISO(data.patient.date_of_birth))
    : null;

  const formattedDate = data?.scheduled_time
    ? format(parseISO(data.scheduled_time), 'dd/MM/yyyy HH:mm', { locale: vi })
    : '';

  const bmi = data?.vitals?.weight_kg && data?.vitals?.height_cm
    ? (data.vitals.weight_kg / Math.pow(data.vitals.height_cm / 100, 2)).toFixed(1)
    : null;

  if (loading) {
    return (
      <div style={{ maxWidth: 800 }} className="mx-auto">
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 800 }} className="mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-teal-600 font-bold text-sm mb-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách lịch sử khám
        </button>
        <div className="text-center py-12 text-muted-foreground">
          Không tìm thấy thông tin lịch khám.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }} className="mx-auto">
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-teal-600 font-bold text-sm mb-4 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách lịch sử khám
      </button>

      {/* Main container */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div>
            <div className="flex items-center gap-2.5" style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>
              <Stethoscope className="h-5 w-5 text-rose-600" />
              <span>Khám bệnh — {data.patient?.full_name ?? 'Không rõ'}</span>
            </div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>
              Ngày khám: {formattedDate}
              {age && ` • ${age} tuổi`}
              {data.patient?.phone && ` • ${data.patient.phone}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
            Đóng
          </button>
        </div>

        {/* Doctor card */}
        <div
          style={{
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#FFE4E6',
              color: '#BE123C',
              fontWeight: 800,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            BS
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>
              {data.doctor?.full_name ?? 'Chưa có thông tin bác sĩ'}
            </div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 2 }}>
              Chuyên khoa {data.doctor?.specialty_name ?? '—'}
            </div>
          </div>
        </div>

        {/* Vitals card */}
        {data.vitals && (
          <div
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 18,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ color: '#BE123C', fontSize: 14.5, fontWeight: 800, marginBottom: 16 }}>
              <Heart className="h-4 w-4" />
              Sinh hiệu
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px 24px',
                fontSize: 14,
              }}
            >
              <div><span style={{ color: '#64748B' }}>HA Tâm thu:</span> <b style={{ color: '#0F172A' }}>{data.vitals.bp_systolic ?? '—'} mmHg</b></div>
              <div><span style={{ color: '#64748B' }}>HA Tâm trương:</span> <b style={{ color: '#0F172A' }}>{data.vitals.bp_diastolic ?? '—'} mmHg</b></div>
              <div><span style={{ color: '#64748B' }}>Nhịp tim:</span> <b style={{ color: '#0F172A' }}>{data.vitals.heart_rate ?? '—'} bpm</b></div>
              <div><span style={{ color: '#64748B' }}>Nhiệt độ:</span> <b style={{ color: '#0F172A' }}>{data.vitals.temperature_c ?? '—'} °C</b></div>
              <div><span style={{ color: '#64748B' }}>Nhịp thở:</span> <b style={{ color: '#0F172A' }}>{data.vitals.respiratory_rate ?? '—'} l/ph</b></div>
              <div><span style={{ color: '#64748B' }}>SpO2:</span> <b style={{ color: '#0F172A' }}>{data.vitals.spo2 ?? '—'} %</b></div>
              <div><span style={{ color: '#64748B' }}>Cân nặng:</span> <b style={{ color: '#0F172A' }}>{data.vitals.weight_kg ?? '—'} kg</b></div>
              <div><span style={{ color: '#64748B' }}>Chiều cao:</span> <b style={{ color: '#0F172A' }}>{data.vitals.height_cm ?? '—'} cm</b></div>
              <div><span style={{ color: '#64748B' }}>BMI:</span> <b style={{ color: '#0F172A' }}>{bmi ?? '—'}</b></div>
            </div>
          </div>
        )}

        {/* Pre-consultation card */}
        {data.pre_consultation && (
          <div
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 18,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ color: '#0F172A', fontSize: 14.5, fontWeight: 800, marginBottom: 16 }}>
              <ClipboardList className="h-4 w-4" />
              Khai báo y tế trước khám
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Left: Symptoms */}
              <div style={{ background: '#FFF1F2', border: '1px solid #FFE4E6', borderRadius: 10, padding: 16 }}>
                <div className="flex items-center gap-1.5" style={{ color: '#BE123C', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>
                  <Stethoscope className="h-3.5 w-3.5" />
                  Triệu chứng chính
                </div>
                <div style={{ fontWeight: 800, fontSize: 16.5, color: '#0F172A', margin: '4px 0 2px' }}>
                  {data.pre_consultation.chief_complaint || 'Chưa khai báo'}
                </div>
                {data.pre_consultation.duration && (
                  <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 10 }}>
                    Thời gian: {data.pre_consultation.duration}
                  </div>
                )}
                {data.pre_consultation.associated_symptoms && data.pre_consultation.associated_symptoms.length > 0 && (
                  <div style={{ fontSize: 12.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>ĐI KÈM:</span>
                    {data.pre_consultation.associated_symptoms.map((s, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'white',
                          border: '1px solid #CBD5E1',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: History & Medications */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#FFF1F2', border: '1px solid #FFE4E6', borderRadius: 10, padding: '14px 16px' }}>
                  <div className="flex items-center gap-1.5" style={{ color: '#BE123C', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>
                    <History className="h-3.5 w-3.5" />
                    Bệnh sử
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                    {data.pre_consultation.medical_history && data.pre_consultation.medical_history.length > 0
                      ? data.pre_consultation.medical_history.map(formatMedicalHistory).map((h, i) => (
                          <div key={i}>• {h}</div>
                        ))
                      : 'Không có tiền sử bệnh'}
                  </div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 10, padding: '14px 16px' }}>
                  <div className="flex items-center gap-1.5" style={{ color: '#16A34A', fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>
                    <Pill className="h-3.5 w-3.5" />
                    Thuốc đang dùng
                  </div>
                  <div style={{ fontSize: 14, fontStyle: 'italic', color: '#16A34A', fontWeight: 600 }}>
                    {data.pre_consultation.current_medications
                      ? typeof data.pre_consultation.current_medications === 'string'
                        ? data.pre_consultation.current_medications
                        : data.pre_consultation.current_medications.length > 0
                          ? data.pre_consultation.current_medications.map(formatMedication).join(', ')
                          : 'Không dùng thuốc'
                      : 'Không dùng thuốc'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clinical notes card */}
        {data.examination && (
          <div
            style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 18,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ color: '#0F172A', fontSize: 14.5, fontWeight: 800, marginBottom: 16 }}>
              <FileText className="h-4 w-4" />
              Ghi chú lâm sàng
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* S - Subjective */}
              {data.examination.s_text && (
                <div>
                  <div style={{ color: '#BE123C', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                    LỜI KHAI BỆNH NHÂN <span style={{ color: '#64748B', fontWeight: 400, fontSize: 12.5, textTransform: 'none' }}>Triệu chứng, bệnh sử, lý do</span>
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#1E293B', lineHeight: 1.5 }}>
                    {data.examination.s_text}
                  </div>
                </div>
              )}

              {/* O - Objective */}
              {data.examination.o_text && (
                <div>
                  <div style={{ color: '#BE123C', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                    KẾT QUẢ KHÁM THỰC THỂ <span style={{ color: '#64748B', fontWeight: 400, fontSize: 12.5, textTransform: 'none' }}>Sinh hiệu, đánh giá lâm sàng</span>
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#1E293B', lineHeight: 1.5 }}>
                    {data.examination.o_text}
                  </div>
                </div>
              )}

              {/* A - Assessment */}
              {data.examination.a_text && (
                <div>
                  <div style={{ color: '#BE123C', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                    CHẨN ĐOÁN LÂM SÀNG
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#1E293B', lineHeight: 1.5 }}>
                    {data.examination.a_text}
                  </div>
                </div>
              )}

              {/* P - Plan */}
              {data.examination.p_text && (
                <div>
                  <div style={{ color: '#BE123C', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                    KẾ HOẠCH ĐIỀU TRỊ <span style={{ color: '#64748B', fontWeight: 400, fontSize: 12.5, textTransform: 'none' }}>Hướng xử trí, dặn dò</span>
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#1E293B', lineHeight: 1.5 }}>
                    {data.examination.p_text}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back button at bottom */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 18, borderTop: '1px solid #E2E8F0' }}>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách
          </button>
        </div>
      </div>
    </div>
  );
}
