import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Check,
  ClipboardList,
  Clock,
  Home,
  Hospital,
  Loader2,
  MapPin,
  RotateCw,
  Send,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Appointment } from '@/types/appointment';

type Props = {
  appointment: Appointment;
  onSubmit: (data: IntakeFormData) => Promise<void>;
  onBack?: () => void;
};

export type IntakeFormData = {
  chief_complaint: string;
  symptom_duration: string;
  pain_level: string;
  current_medications: string;
  allergies: string;
};

const DURATION_OPTIONS = [
  'Định kỳ theo hẹn',
  'Dưới 3 ngày',
  'Khoảng 1 tuần',
  'Hơn 1 tháng',
];

const PAIN_OPTIONS = [
  '0/10 — Không đau',
  '1-3/10 — Nhẹ',
  '4-6/10 — Vừa phải',
  '7-10/10 — Đau nhiều',
];

export default function BookingIntakeForm({ appointment, onSubmit, onBack }: Props) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<IntakeFormData>({
    chief_complaint: '',
    symptom_duration: DURATION_OPTIONS[0],
    pain_level: PAIN_OPTIONS[0],
    current_medications: '',
    allergies: '',
  });

  const dateLabel = appointment.slot_date
    ? format(parseISO(appointment.slot_date), 'EEEE, dd/MM/yyyy', { locale: vi })
    : '';
  const timeLabel = appointment.start_time?.slice(0, 5) || '';

  async function handleSubmit() {
    if (!formData.chief_complaint.trim()) {
      toast.error('Vui lòng nhập lý do khám hoặc triệu chứng chính');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      setSuccess(true);
      toast.success('Gửi phiếu khai báo y tế thành công!');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-[18px] p-8 shadow-sm">
        <div className="text-center py-5">
          <div
            className="w-[88px] h-[88px] rounded-full bg-emerald-50 border-[3px] border-emerald-300 flex items-center justify-center mx-auto mb-5"
            style={{ animation: 'successPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
          >
            <CalendarCheck className="h-[38px] w-[38px] text-emerald-600" />
          </div>

          <h1 className="text-[28px] font-bold text-slate-800 mb-1.5 tracking-[-0.5px]">
            Đặt lịch & Khai báo y tế thành công! 🎉
          </h1>
          <p className="text-slate-500 text-base mb-7">
            Lịch hẹn khám và thông tin khai báo y tế đã được xác nhận. Mã lịch hẹn:{' '}
            <strong className="text-slate-800 text-[17px]">
              #{appointment.id.slice(0, 8).toUpperCase()}
            </strong>
          </p>

          {/* Appointment card */}
          <div className="bg-teal-50 border-[1.5px] border-teal-200 rounded-[18px] p-[22px_24px] text-left max-w-[520px] mx-auto mb-6">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Đã xác nhận
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
                <ClipboardList className="h-3.5 w-3.5" />
                Đã gửi phiếu khai báo y tế
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-slate-100 text-slate-600">
                <Hospital className="h-3.5 w-3.5" />
                Khám trực tiếp
              </span>
            </div>

            <div className="space-y-0">
              <SuccessRow
                icon={<User className="h-4 w-4" />}
                label="Dịch vụ khám"
                value={appointment.specialty_name}
              />
              <SuccessRow
                icon={<Calendar className="h-4 w-4" />}
                label="Ngày & Giờ khám"
                value={`${dateLabel} — ${timeLabel}`}
                highlight
              />
              <SuccessRow
                icon={<MapPin className="h-4 w-4" />}
                label="Địa điểm khám"
                value="Phòng khám RCARE Quận 3"
                subValue="128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q3"
              />
            </div>

            {/* Checklist */}
            <div className="bg-white rounded-lg p-[14px_16px] mt-3">
              <div className="text-[14.5px] font-bold text-slate-800 mb-2.5 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-teal-600" />
                Bạn cần chuẩn bị gì?
              </div>
              <div className="text-[14px] text-slate-700 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  Mang theo CCCD gốc hoặc bản sao
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  Kết quả xét nghiệm gần nhất (nếu có)
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  Có mặt <strong>trước 15 phút</strong> để hoàn thành thủ tục
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons grid */}
          <div className="grid grid-cols-2 gap-[10px] max-w-[520px] mx-auto">
            <button
              onClick={() => navigate('/appointments')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
            >
              <CalendarCheck className="h-4 w-4" />
              Xem chi tiết lịch hẹn
            </button>
            <button
              onClick={() => toast.info('Đã thêm vào Google Calendar / iCal')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4" />
              Thêm vào lịch cá nhân
            </button>
            <button
              onClick={() => toast.info('Mở giao diện đổi lịch...')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
            >
              <RotateCw className="h-4 w-4" />
              Đổi lịch khám
            </button>
            <button
              onClick={() => toast.info('Mở giao diện hủy lịch...')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-red-500 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
            >
              <X className="h-4 w-4" />
              Hủy lịch này
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-9 py-3.5 rounded-full text-[17px] font-semibold transition-all min-h-[52px] cursor-pointer"
          >
            <Home className="h-4 w-4" />
            Quay về Trang chủ
          </button>
        </div>

        <style>{`
          @keyframes successPop {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Intake form
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      {/* Left Column - Form */}
      <div className="bg-white border border-slate-200 rounded-[18px] p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-[22px] font-bold text-slate-800 tracking-[-0.3px]">
            Phiếu khai báo y tế trước khám
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
            <span className="text-amber-600">✱</span>
            Bắt buộc hoàn thành
          </span>
        </div>
        <p className="text-slate-500 text-[14.5px] mb-5">
          Lịch hẹn của bạn đã được ghi nhận. Vui lòng hoàn thành các thông tin y tế dưới đây để Bác
          sĩ chuẩn bị hồ sơ tốt nhất trước giờ khám.
        </p>

        {/* Appointment Banner */}
        <div className="bg-emerald-50 border-[1.5px] border-emerald-300 rounded-[12px] p-[14px_18px] mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-[22px] w-[22px] text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-extrabold text-[15px] text-emerald-800">
                Lịch hẹn: #{appointment.id.slice(0, 8).toUpperCase()} · {dateLabel} — {timeLabel}
              </div>
              <div className="text-[13px] text-emerald-700">
                Dịch vụ: <strong>{appointment.specialty_name}</strong>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Đã ghi nhận lịch
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Field 1: Chief complaint */}
          <div>
            <label className="block text-[14px] font-bold text-slate-700 mb-2">
              1. Lý do khám hoặc triệu chứng chính{' '}
              <span className="text-red-500 font-bold">* (Bắt buộc)</span>
            </label>
            <textarea
              value={formData.chief_complaint}
              onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
              rows={3}
              placeholder="Mô tả cụ thể lý do bạn muốn khám hoặc triệu chứng xuất hiện..."
              className="w-full px-4 py-3 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all resize-none"
              required
            />
          </div>

          {/* Field 2 & 3: Duration + Pain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-bold text-slate-700 mb-2">
                2. Thời gian xuất hiện triệu chứng
              </label>
              <select
                value={formData.symptom_duration}
                onChange={(e) => setFormData({ ...formData, symptom_duration: e.target.value })}
                className="w-full px-4 py-3 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all bg-white cursor-pointer"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-bold text-slate-700 mb-2">
                3. Mức độ khó chịu / Đau
              </label>
              <select
                value={formData.pain_level}
                onChange={(e) => setFormData({ ...formData, pain_level: e.target.value })}
                className="w-full px-4 py-3 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all bg-white cursor-pointer"
              >
                {PAIN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Field 4 & 5: Medications + Allergies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[14px] font-bold text-slate-700 mb-2">
                4. Thuốc đang sử dụng hiện tại
              </label>
              <input
                type="text"
                value={formData.current_medications}
                onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
                placeholder="Nhập tên thuốc (nếu có)..."
                className="w-full px-4 py-3 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[14px] font-bold text-slate-700 mb-2">
                5. Tiền sử dị ứng thuốc & Thực phẩm
              </label>
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="Nhập thông tin dị ứng (nếu có)..."
                className="w-full px-4 py-3 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 mt-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-7 py-3.5 rounded-full text-[15px] font-semibold transition-colors min-h-[52px] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-9 py-3.5 rounded-full text-[17px] font-bold transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 min-h-[56px] cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Gửi phiếu khai báo y tế & Hoàn tất
                <ArrowRight className="h-5 w-5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Summary Panel */}
      <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] p-[22px] sticky top-[90px]">
        <div className="text-[13px] font-extrabold text-slate-500 uppercase tracking-[0.6px] mb-[14px]">
          Lịch khám của bạn
        </div>

        <SummaryRow
          icon={<Stethoscope className="h-4 w-4" />}
          label="Dịch vụ"
          value={appointment.specialty_name}
        />
        <SummaryRow icon={<User className="h-4 w-4" />} label="Bác sĩ" value="Bác sĩ sẵn sàng" />
        <SummaryRow
          icon={<Calendar className="h-4 w-4" />}
          label="Ngày & Giờ"
          value={`${dateLabel} — ${timeLabel}`}
          highlight
        />
        <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Địa điểm" value="RCARE Quận 3" />
      </div>
    </div>
  );
}

type SummaryRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
};

function SummaryRow({ icon, label, value, highlight }: SummaryRowProps) {
  return (
    <div className="flex gap-[10px] py-[10px] border-b border-slate-100 last:border-b-0">
      <div className="w-5 text-slate-500 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold text-slate-500">{label}</div>
        <div className={`text-[15px] font-bold ${highlight ? 'text-teal-600' : 'text-slate-800'}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

type SuccessRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
};

function SuccessRow({ icon, label, value, subValue, highlight }: SuccessRowProps) {
  return (
    <div className="flex gap-[10px] py-[10px] border-b border-teal-200 last:border-b-0">
      <div className="w-5 text-teal-600 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[13px] text-slate-500">{label}</div>
        <div
          className={`font-bold ${highlight ? 'text-[18px] text-teal-600' : 'text-[16px] text-slate-800'}`}
        >
          {value}
        </div>
        {subValue && <div className="text-[13.5px] text-slate-500">{subValue}</div>}
      </div>
    </div>
  );
}
