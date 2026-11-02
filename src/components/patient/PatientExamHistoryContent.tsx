import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronRight, Loader2, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMyAppointments } from '@/lib/appointment-api';
import type { Appointment } from '@/types/appointment';
import PatientExamHistoryDetail from './PatientExamHistoryDetail';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Hoàn thành',
    className: 'bg-emerald-50 border border-emerald-200 text-emerald-600',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'bg-slate-100 border border-slate-200 text-slate-500',
  },
  CHECKED_IN: {
    label: 'Đã check-in',
    className: 'bg-teal-50 border border-teal-200 text-teal-600',
  },
  IN_PROGRESS: {
    label: 'Đang khám',
    className: 'bg-amber-50 border border-amber-200 text-amber-600',
  },
  SCHEDULED: {
    label: 'Đã đặt',
    className: 'bg-blue-50 border border-blue-200 text-blue-600',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    className: 'bg-blue-50 border border-blue-200 text-blue-600',
  },
  NO_SHOW: {
    label: 'Không đến',
    className: 'bg-red-50 border border-red-200 text-red-600',
  },
};

export default function PatientExamHistoryContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyAppointments()
      .then((data) => {
        if (!cancelled) {
          const historyStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
          const filtered = data.filter((a) => historyStatuses.includes(a.status));
          setAppointments(filtered);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          toast.error(e.message);
          setAppointments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: vi });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  // Show detail view inline
  if (detailId) {
    return (
      <PatientExamHistoryDetail
        appointmentId={detailId}
        onBack={() => setDetailId(null)}
      />
    );
  }

  // Show list view
  return (
    <div style={{ maxWidth: 1080 }} className="mx-auto">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground mb-4">
        Lịch sử khám
      </div>

      {/* Header */}
      <div className="mb-6 pb-4">
        <h2 className="text-2xl font-extrabold text-foreground mb-1.5">
          Lịch sử khám bệnh
        </h2>
        <p className="text-sm text-muted-foreground">
          Theo dõi các buổi khám trước đây của bạn, bao gồm các ghi chú và chỉ định của Bác sĩ.
        </p>
      </div>

      {/* Table Container */}
      <div
        className="bg-white overflow-hidden"
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Chưa có lịch sử khám bệnh.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-[#F1F5F9]">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 space-y-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                  onClick={() => setDetailId(apt.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-[#0F172A] text-[14.5px]">
                        {formatDate(apt.slot_date)}
                      </div>
                      <div className="text-[12.5px] text-[#64748B] mt-0.5">
                        {formatTime(apt.start_time)}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-bold ${
                        STATUS_CONFIG[apt.status]?.className ?? 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {STATUS_CONFIG[apt.status]?.label ?? apt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#1E293B] font-bold">
                    <Stethoscope className="h-4 w-4 text-[#64748B]" />
                    {apt.specialty_name}
                  </div>
                  {apt.note && (
                    <div className="text-sm text-[#334155] font-semibold">
                      {apt.note}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDetailId(apt.id); }}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-lg text-white text-[13px] font-bold transition-colors"
                    style={{
                      padding: '6px 14px',
                      background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
                    }}
                  >
                    Xem chi tiết
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      background: '#FAFAFA',
                      color: '#64748B',
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    <th style={{ padding: '16px 20px' }}>Ngày khám</th>
                    <th style={{ padding: '16px 20px' }}>Chuyên khoa</th>
                    <th style={{ padding: '16px 20px' }}>Ghi chú</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt, idx) => (
                    <tr
                      key={apt.id}
                      className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                      style={{
                        borderBottom: idx < appointments.length - 1 ? '1px solid #F1F5F9' : 'none',
                      }}
                      onClick={() => setDetailId(apt.id)}
                    >
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14.5px' }}>
                          {formatDate(apt.slot_date)}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: 2 }}>
                          {formatTime(apt.start_time)}
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px' }}>
                        <div className="flex items-center gap-2" style={{ fontWeight: 700, color: '#1E293B' }}>
                          <Stethoscope className="h-4 w-4" style={{ color: '#64748B' }} />
                          {apt.specialty_name}
                        </div>
                      </td>
                      <td style={{ padding: '18px 20px', color: apt.note ? '#334155' : '#64748B', fontWeight: apt.note ? 600 : 500 }}>
                        {apt.note || '--'}
                      </td>
                      <td style={{ padding: '18px 20px', textAlign: 'center' }}>
                        <span
                          className={`inline-flex items-center rounded-full text-xs font-bold ${
                            STATUS_CONFIG[apt.status]?.className ?? 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                          style={{ padding: '4px 14px' }}
                        >
                          {STATUS_CONFIG[apt.status]?.label ?? apt.status}
                        </span>
                      </td>
                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDetailId(apt.id); }}
                          className="inline-flex items-center gap-1 rounded-lg text-white font-bold transition-colors hover:opacity-90"
                          style={{
                            padding: '6px 14px',
                            fontSize: 13,
                            background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
                          }}
                        >
                          Xem chi tiết
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
