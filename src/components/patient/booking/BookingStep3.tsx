import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertCircle,
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
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  bookAppointment,
  bookingBlockedMessage,
  canPatientSelfBook,
  fetchPatientProfile,
  mapBookingError,
} from '@/lib/appointment-api';
import { formatSlotTime } from '@/types/appointment';
import type { Specialty, AppointmentSlot } from '@/types/appointment';
import { useAuth } from '@/hooks/use-auth';

type Doctor = {
  id: string;
  name: string;
  title: string;
  specialties: string;
  location: string;
  nextAvailable: string;
  avatarColor: string;
  initials: string;
};

type Props = {
  specialty: Specialty;
  date: Date;
  slot: AppointmentSlot;
  doctor?: Doctor | null;
  onBack?: () => void;
  onEditSpecialty?: () => void;
  onEditDateTime?: () => void;
};

type Profile = {
  id: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  submitted_at: string | null;
  status: string | null;
  date_of_birth: string | null;
  phone: string | null;
};

export default function BookingStep3({
  specialty,
  date,
  slot,
  doctor,
  onBack,
  onEditSpecialty,
  onEditDateTime,
}: Props) {
  const doctorName = doctor?.id === 'any' || !doctor ? 'Bác sĩ sẵn sàng' : doctor.name;
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ appointmentId: string } | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    fetchPatientProfile(session.user.id).then(setProfile);
  }, [session?.user.id]);

  const profileName = profile
    ? [profile.legal_first_name, profile.legal_last_name].filter(Boolean).join(' ') ||
      'Hồ sơ của tôi'
    : '—';

  const initials = profileName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleConfirm() {
    if (!profile) return;

    if (!canPatientSelfBook(profile.status)) {
      toast.error(bookingBlockedMessage());
      return;
    }

    setSubmitting(true);
    try {
      const appointmentId = await bookAppointment({
        profile_id: profile.id,
        specialty_id: specialty.id,
        slot_id: slot.id,
      });
      toast.success('Đặt lịch thành công! Vui lòng hoàn tất khai báo y tế.');
      navigate(`/appointments/${appointmentId}/pre-consultation?from=booking`);
    } catch (e) {
      toast.error(mapBookingError((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen
  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-[18px] p-8 shadow-sm">
        <div className="text-center py-5">
          {/* Success icon */}
          <div
            className="w-[88px] h-[88px] rounded-full bg-emerald-50 border-[3px] border-emerald-300 flex items-center justify-center mx-auto mb-5"
            style={{ animation: 'successPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
          >
            <CalendarCheck className="h-[38px] w-[38px] text-emerald-600" />
          </div>

          <h1 className="text-[28px] font-bold text-slate-800 mb-1.5 tracking-[-0.5px]">
            Đặt lịch thành công! 🎉
          </h1>
          <p className="text-slate-500 text-base mb-7">
            Lịch hẹn khám đã được xác nhận. Mã lịch hẹn:{' '}
            <strong className="text-slate-800 text-[17px]">
              #{success.appointmentId.slice(0, 8).toUpperCase()}
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
              <SuccessDetailRow
                icon={<User className="h-4 w-4" />}
                label="Bác sĩ phụ trách"
                value={doctorName}
              />
              <SuccessDetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Ngày & Giờ khám"
                value={`${format(date, 'EEEE, dd/MM/yyyy', { locale: vi })} — ${formatSlotTime(slot.start_time)}`}
                highlight
              />
              <SuccessDetailRow
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

          {/* Email notification */}
          <div className="max-w-[520px] mx-auto mb-6 bg-sky-50 border border-sky-200 rounded-[10px] px-[18px] py-[14px] text-[14px] text-sky-700">
            ✉️ Xác nhận lịch hẹn đã được gửi tới{' '}
            <strong>{session?.user?.email}</strong>.
          </div>

          {/* Action buttons grid */}
          <div className="grid grid-cols-2 gap-[10px] max-w-[520px] mx-auto">
            <button
              onClick={() => navigate('/appointments')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px]"
            >
              <CalendarCheck className="h-4 w-4" />
              Xem chi tiết lịch hẹn
            </button>
            <button
              onClick={() => toast.info('Đã thêm vào Google Calendar / iCal')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px]"
            >
              <CalendarPlus className="h-4 w-4" />
              Thêm vào lịch cá nhân
            </button>
            <button
              onClick={() => toast.info('Mở giao diện đổi lịch...')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px]"
            >
              <RotateCw className="h-4 w-4" />
              Đổi lịch khám
            </button>
            <button
              onClick={() => toast.info('Mở giao diện hủy lịch...')}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-red-500 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px]"
            >
              <X className="h-4 w-4" />
              Hủy lịch này
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-9 py-3.5 rounded-full text-[17px] font-semibold transition-all min-h-[52px]"
          >
            <Home className="h-4 w-4" />
            Quay về Trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Confirmation form
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      {/* Left Column */}
      <div className="bg-white border border-slate-200 rounded-[18px] p-7 shadow-sm">
        <h2 className="text-[22px] font-bold text-slate-800 tracking-[-0.3px] mb-1.5">
          Xác nhận thông tin lịch khám
        </h2>
        <p className="text-slate-500 text-[14.5px] mb-5">
          Vui lòng kiểm tra lại thông tin lịch khám của bạn trước khi tiến hành bước khai báo y tế
          bắt buộc.
        </p>

        {/* Patient Info Block */}
        <div className="bg-teal-50 border-[1.5px] border-teal-600 rounded-[12px] p-[14px_18px] mb-5 flex items-center gap-[14px]">
          <div className="w-[46px] h-[46px] rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base font-bold">{initials}</span>
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-slate-800">{profileName}</div>
            <div className="text-[13.5px] text-slate-500">
              {profile?.phone && (
                <span>
                  SĐT: <strong>{profile.phone}</strong>
                </span>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Đặt cho bản thân
          </span>
        </div>

        {/* Group: Chi tiết lịch khám */}
        <div className="text-[12.5px] font-extrabold text-slate-500 uppercase tracking-[0.6px] mb-[10px]">
          Chi tiết lịch khám đã chọn
        </div>
        <div className="border border-slate-200 rounded-[14px] overflow-hidden mb-5">
          <ConfirmRow
            label="Dịch vụ"
            value={specialty.name}
            onEdit={onEditSpecialty}
          />
          <ConfirmRow label="Bác sĩ" value={doctorName} onEdit={onEditDateTime} />
          <ConfirmRow
            label="Ngày & Giờ khám"
            value={`${format(date, 'EEEE, dd/MM/yyyy', { locale: vi })} — ${formatSlotTime(slot.start_time)}`}
            highlight
            onEdit={onEditDateTime}
          />
          <ConfirmRow
            label="Địa điểm khám"
            value="Phòng khám RCARE Quận 3"
            subValue="128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q3, TP.HCM"
          />
        </div>

        {/* Mandatory Next Step Notice */}
        <div className="bg-sky-50 border-[1.5px] border-sky-300 rounded-[12px] p-[16px_18px] mb-6 flex items-start gap-[14px]">
          <AlertCircle className="h-[22px] w-[22px] text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-[14.5px] text-sky-800 mb-1">
              Yêu cầu bắt buộc: Khai báo y tế trước khám
            </div>
            <div className="text-[13.5px] text-sky-700 leading-relaxed">
              Sau khi bấm <strong>"Xác nhận đặt lịch & Khai báo y tế"</strong>, hệ thống sẽ chuyển
              sang bước <strong>Khai báo y tế bắt buộc</strong> để Bác sĩ nắm rõ triệu chứng và
              chuẩn bị hồ sơ trước buổi khám của bạn.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-7 py-3.5 rounded-full text-[15px] font-semibold transition-colors min-h-[52px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !canPatientSelfBook(profile?.status)}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-9 py-3.5 rounded-full text-[17.5px] font-bold transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 min-h-[56px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <CalendarCheck className="h-5 w-5" />
                Xác nhận đặt lịch & Khai báo y tế
                <ArrowRight className="h-5 w-5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Summary Panel */}
      <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] p-[22px] sticky top-[90px]">
        <div className="text-[13px] font-extrabold text-slate-500 uppercase tracking-[0.6px] mb-[14px]">
          Tóm tắt lịch hẹn
        </div>

        <SummaryRow icon={<Stethoscope className="h-4 w-4" />} label="Dịch vụ" value={specialty.name} />
        <SummaryRow icon={<User className="h-4 w-4" />} label="Bác sĩ" value={doctorName} />
        <SummaryRow
          icon={<Calendar className="h-4 w-4" />}
          label="Ngày & Giờ"
          value={`${format(date, 'EEEE, dd/MM', { locale: vi })} — ${formatSlotTime(slot.start_time)}`}
          highlight
        />
        <SummaryRow
          icon={<MapPin className="h-4 w-4" />}
          label="Địa điểm"
          value="RCARE Quận 3"
        />
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

type ConfirmRowProps = {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
  onEdit?: () => void;
};

function ConfirmRow({ label, value, subValue, highlight, onEdit }: ConfirmRowProps) {
  return (
    <div className="flex justify-between items-start px-[18px] py-[13px] border-b border-slate-100 last:border-b-0">
      <span className="text-[13.5px] font-semibold text-slate-500 min-w-[100px]">{label}</span>
      <div className="flex items-center gap-[10px]">
        <div className="text-right">
          <div
            className={`text-[15px] font-semibold ${
              highlight ? 'text-teal-600 font-extrabold text-base' : 'text-slate-800'
            }`}
          >
            {value}
          </div>
          {subValue && <div className="text-[13px] text-slate-500 font-normal">{subValue}</div>}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1 text-[13px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            Sửa
          </button>
        )}
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

type SuccessDetailRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
};

function SuccessDetailRow({ icon, label, value, subValue, highlight }: SuccessDetailRowProps) {
  return (
    <div className="flex gap-[10px] py-[10px] border-b border-teal-200 last:border-b-0">
      <div className="w-5 text-teal-600 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[13px] text-slate-500">{label}</div>
        <div
          className={`font-bold ${
            highlight ? 'text-[18px] text-teal-600' : 'text-[16px] text-slate-800'
          }`}
        >
          {value}
        </div>
        {subValue && <div className="text-[13.5px] text-slate-500">{subValue}</div>}
      </div>
    </div>
  );
}
