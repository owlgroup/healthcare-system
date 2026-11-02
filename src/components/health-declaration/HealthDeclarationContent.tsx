/**
 * Health Declaration Content
 * List of submitted pre-consultation health declaration forms
 */

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { fetchMyAppointments } from '@/lib/appointment-api';
import { getMyPreConsultations } from '@/lib/pre-consultation-api';
import type { PreConsultation } from '@/types/pre-consultation';
import type { Appointment } from '@/types/appointment';
import { formatSlotTime } from '@/types/appointment';
import HealthDeclarationDetail from './HealthDeclarationDetail';

type PreConsultationWithAppointment = PreConsultation & {
  appointment: Appointment | null;
};

export default function HealthDeclarationContent() {
  const [loading, setLoading] = useState(true);
  const [preConsultations, setPreConsultations] = useState<PreConsultationWithAppointment[]>([]);
  const [selectedItem, setSelectedItem] = useState<PreConsultationWithAppointment | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [pcList, appointments] = await Promise.all([
          getMyPreConsultations(),
          fetchMyAppointments(),
        ]);

        const combined = pcList
          .filter((pc) => pc.status === 'SUBMITTED')
          .map((pc) => ({
            ...pc,
            appointment: appointments.find((a) => a.id === pc.appointment_id) ?? null,
          }));

        setPreConsultations(combined);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  function handleViewDetail(pc: PreConsultationWithAppointment) {
    setSelectedItem(pc);
  }

  function handleBack() {
    setSelectedItem(null);
  }

  function formatDate(dateStr: string): string {
    try {
      const date = parseISO(dateStr);
      return format(date, 'EEEE, dd/MM/yyyy', { locale: vi });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(dateStr: string): string {
    try {
      const date = parseISO(dateStr);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch {
      return dateStr;
    }
  }

  function getStatusBadge(pc: PreConsultationWithAppointment) {
    const aptStatus = pc.appointment?.status;
    if (aptStatus === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Đã hoàn thành khám
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Đã gửi phiếu khai báo
      </span>
    );
  }

  function generateFormCode(pc: PreConsultation): string {
    const year = pc.submitted_at ? new Date(pc.submitted_at).getFullYear() : new Date().getFullYear();
    const num = pc.id.slice(-4).toUpperCase();
    return `#ITK-${year}-${num}`;
  }

  function generateAppointmentCode(appointmentId: string): string {
    const num = appointmentId.slice(-4).toUpperCase();
    return `#APT-${new Date().getFullYear()}-${num}`;
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto p-8 lg:p-9 bg-[#F8FAFC]">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </main>
    );
  }

  // Show detail view
  if (selectedItem) {
    return (
      <main className="flex-1 overflow-y-auto p-8 lg:p-9 bg-[#F8FAFC]">
        <div className="max-w-[1240px] mx-auto">
          <p className="text-slate-500 text-[14px] mb-4">Khai báo y tế trước khám</p>
          <HealthDeclarationDetail data={selectedItem} onBack={handleBack} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 lg:p-9 bg-[#F8FAFC]">
      <div className="max-w-[1240px] mx-auto">
        {/* Card Container */}
        <div className="bg-white border border-slate-200 rounded-[18px] p-7 shadow-sm">
          {/* Section Header */}
          <div className="mb-6">
            <p className="text-slate-500 text-[14px] mb-4">Khai báo y tế trước khám</p>
            <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">
              Phiếu khai báo y tế trước khám
            </h2>
            <p className="text-slate-500 text-[14.5px] mt-1.5">
              Danh sách phiếu khai báo thông tin y tế trước khám đã gửi tới Bác sĩ phụ trách.
              Bấm vào từng phiếu để xem chi tiết đầy đủ.
            </p>
          </div>

          {/* List */}
          {preConsultations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Chưa có phiếu khai báo nào
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Sau khi đặt lịch khám và hoàn thành khai báo y tế, các phiếu sẽ hiển thị ở đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {preConsultations.map((pc, index) => {
                const isFirst = index === 0;
                const borderColors = ['border-l-teal-500', 'border-l-blue-500', 'border-l-purple-500'];
                const leftBorderColor = borderColors[index % borderColors.length];
                return (
                <div
                  key={pc.id}
                  className={`border border-l-4 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer ${leftBorderColor} ${
                    isFirst
                      ? 'border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-white'
                      : 'border-t-slate-200 border-r-slate-200 border-b-slate-200'
                  }`}
                  onClick={() => handleViewDetail(pc)}
                >
                  <div className="flex items-center gap-4">
                    {/* Left Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        {getStatusBadge(pc)}
                        <span className="text-slate-500 text-[13.5px]">
                          Mã phiếu: <span className="font-semibold text-slate-700">{generateFormCode(pc)}</span>
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 text-[13.5px]">
                          Lịch hẹn: <span className="font-semibold text-slate-700">{generateAppointmentCode(pc.appointment_id)}</span>
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-[17px] font-semibold text-slate-800 mb-2">
                        {pc.chief_complaint || pc.appointment?.note || 'Khám tổng quát'}
                        {pc.appointment?.specialty_name && (
                          <span className="text-slate-500 font-normal"> — {pc.appointment.specialty_name}</span>
                        )}
                      </h3>

                      {/* Info Row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-slate-600 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-4 w-4 text-slate-400" />
                          <span>BS. {pc.appointment?.specialty_name || 'Chưa phân công'}</span>
                        </div>
                        {pc.appointment?.slot_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span>
                              Ngày khám: {formatDate(pc.appointment.slot_date)}
                              {pc.appointment.start_time && ` (${formatSlotTime(pc.appointment.start_time)})`}
                            </span>
                          </div>
                        )}
                        {pc.submitted_at && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>Ngày gửi: {formatDateTime(pc.submitted_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Tags Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {pc.drug_allergies && pc.drug_allergies.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12.5px] font-bold bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]">
                            <AlertTriangle className="h-3 w-3" />
                            Dị ứng: {pc.drug_allergies.map((a) => a.drug).join(', ')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12.5px] font-semibold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                            Không có dị ứng thuốc
                          </span>
                        )}
                        {pc.pain_scale !== null && (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[12.5px] font-semibold ${
                              pc.pain_scale >= 7
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                            }`}
                          >
                            {pc.pain_scale >= 7 ? 'Đau nhiều' : 'Không đau'} ({pc.pain_scale}/10)
                          </span>
                        )}
                        {pc.current_medications && pc.current_medications.length > 0 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12.5px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                            {pc.current_medications[0].name}
                            {pc.current_medications.length > 1 && ` +${pc.current_medications.length - 1}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Action Button */}
                    <div className="flex-shrink-0 flex items-center">
                      <Button
                        variant={isFirst ? 'default' : 'outline'}
                        className={`gap-2 rounded-full ${
                          isFirst
                            ? 'bg-teal-600 hover:bg-teal-700 text-white'
                            : 'hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(pc);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Xem chi tiết phiếu
                      </Button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
