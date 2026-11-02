/**
 * Health Declaration Detail View
 * Shows detailed pre-consultation health declaration form
 */

import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PreConsultation } from '@/types/pre-consultation';
import { DURATION_UNIT_LABELS } from '@/types/pre-consultation';
import type { Appointment } from '@/types/appointment';
import { formatSlotTime } from '@/types/appointment';

type PreConsultationWithAppointment = PreConsultation & {
  appointment: Appointment | null;
};

type Props = {
  data: PreConsultationWithAppointment;
  onBack: () => void;
};

export default function HealthDeclarationDetail({ data, onBack }: Props) {
  const pc = data;
  const apt = data.appointment;

  function generateFormCode(): string {
    const year = pc.submitted_at ? new Date(pc.submitted_at).getFullYear() : new Date().getFullYear();
    const num = pc.id.slice(-4).toUpperCase();
    return `#ITK-${year}-${num}`;
  }

  function generateAppointmentCode(): string {
    const num = pc.appointment_id.slice(-4).toUpperCase();
    return `#APT-${new Date().getFullYear()}-${num}`;
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

  function getDurationText(): string {
    if (!pc.symptom_duration) return 'Không rõ';
    const unit = pc.symptom_duration_unit ? DURATION_UNIT_LABELS[pc.symptom_duration_unit] : 'ngày';
    return `${pc.symptom_duration} ${unit}`;
  }

  function getPainText(): string {
    if (pc.pain_scale === null) return 'Không rõ';
    if (pc.pain_scale === 0) return '0/10 — Không đau';
    if (pc.pain_scale >= 7) return `${pc.pain_scale}/10 — Đau nhiều`;
    return `${pc.pain_scale}/10 — Đau nhẹ`;
  }

  function getMedicationsText(): string {
    if (!pc.current_medications || pc.current_medications.length === 0) {
      return 'Không sử dụng thuốc';
    }
    return pc.current_medications.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ');
  }

  function getAllergiesText(): string {
    if (!pc.drug_allergies || pc.drug_allergies.length === 0) {
      return 'Không có dị ứng thuốc';
    }
    return pc.drug_allergies.map((a) => `${a.drug}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ');
  }

  const hasAllergies = pc.drug_allergies && pc.drug_allergies.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[18px] p-7 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5 pb-5 border-b border-slate-200">
        <div>
          <Button
            variant="outline"
            size="sm"
            className="mb-3 gap-2 rounded-full"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách phiếu khai báo
          </Button>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">
            Phiếu khai báo y tế trước khám — {pc.chief_complaint || 'Khám tổng quát'}
          </h2>
          <p className="text-slate-500 text-[14px] mt-1">
            Mã phiếu: <span className="font-semibold text-slate-700">{generateFormCode()}</span>
            {' · '}
            Lịch hẹn: <span className="font-semibold text-slate-700">{generateAppointmentCode()}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Đã gửi đến Bác sĩ phụ trách
        </span>
      </div>

      {/* Patient Info Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-[13.5px]">
          <div>
            <span className="text-slate-500">Bệnh nhân:</span>{' '}
            <span className="font-bold text-slate-800">Bệnh nhân</span>
          </div>
          <div>
            <span className="text-slate-500">Bác sĩ phụ trách:</span>{' '}
            <span className="font-bold text-slate-800">BS. {apt?.specialty_name || 'Chưa phân công'}</span>
          </div>
          <div>
            <span className="text-slate-500">Thời gian khám:</span>{' '}
            <span className="font-bold text-teal-600">
              {apt?.slot_date ? formatDate(apt.slot_date) : '—'}
              {apt?.start_time && ` (${formatSlotTime(apt.start_time)})`}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Thời gian gửi phiếu:</span>{' '}
            <span className="font-bold text-slate-800">
              {pc.submitted_at ? formatDateTime(pc.submitted_at) : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Cơ sở khám:</span>{' '}
            <span className="font-bold text-slate-800">Phòng khám RCARE</span>
          </div>
        </div>
      </div>

      {/* Section 1: Patient Declaration */}
      <div className="border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-800 mb-4">
          <ClipboardList className="h-5 w-5 text-teal-600" />
          1. Nội dung bệnh nhân khai báo trước khám
        </div>

        <div className="space-y-3">
          {/* Chief Complaint */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-[12px] font-bold text-slate-500 uppercase mb-1">
              Lý do khám / Triệu chứng chính:
            </div>
            <div className="text-[15px] font-bold text-slate-800 leading-relaxed">
              {pc.chief_complaint || 'Không có thông tin'}
            </div>
          </div>

          {/* Duration & Pain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-[12px] font-bold text-slate-500 uppercase mb-1">
                Thời gian xuất hiện:
              </div>
              <div className="text-[14.5px] font-bold text-slate-800">
                {getDurationText()}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-[12px] font-bold text-slate-500 uppercase mb-1">
                Mức độ đau / Khó chịu:
              </div>
              <div className={`text-[14.5px] font-bold ${
                pc.pain_scale !== null && pc.pain_scale >= 7 ? 'text-orange-600' : 'text-emerald-600'
              }`}>
                {getPainText()}
              </div>
            </div>
          </div>

          {/* Medications & Allergies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-[12px] font-bold text-slate-500 uppercase mb-1">
                Thuốc đang sử dụng:
              </div>
              <div className="text-[14.5px] font-bold text-blue-600">
                {getMedicationsText()}
              </div>
            </div>
            <div className={`rounded-lg p-4 ${
              hasAllergies
                ? 'bg-[#FFF1F2] border border-[#FECDD3]'
                : 'bg-slate-50 border border-slate-200'
            }`}>
              <div className={`text-[12px] font-bold uppercase mb-1 ${
                hasAllergies ? 'text-[#BE123C]' : 'text-slate-500'
              }`}>
                Cảnh báo dị ứng:
              </div>
              <div className={`text-[14.5px] font-bold ${
                hasAllergies ? 'text-red-600' : 'text-slate-800'
              }`}>
                {getAllergiesText()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Doctor Response */}
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
          <div className="flex items-center gap-2 text-[15px] font-bold text-emerald-800">
            <UserRound className="h-5 w-5" />
            2. Tiếp nhận & Chuẩn bị hồ sơ của Bác sĩ
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đã đồng bộ vào EMR SOAP
          </span>
        </div>
        <p className="text-[14px] text-emerald-900 leading-relaxed mb-3">
          Bác sĩ đã tiếp nhận phiếu khai báo trước khám. Thông tin đã được đồng bộ vào hệ thống EMR để chuẩn bị hồ sơ khám.
        </p>
        <div className="text-[13px] text-emerald-700 font-bold">
          Tiếp nhận bởi: BS. {apt?.specialty_name || 'Chưa phân công'}
        </div>
      </div>
    </div>
  );
}
