import { useEffect, useState } from 'react';
import {
  format,
  isBefore,
  startOfToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Shuffle,
  Stethoscope,
  Sun,
  CloudSun,
  User,
} from 'lucide-react';
import { fetchSlots, fetchDoctorsBySpecialty, type DoctorInfo } from '@/lib/appointment-api';
import type { Specialty, AppointmentSlot } from '@/types/appointment';
import { formatSlotTime } from '@/types/appointment';
import { format as formatDate } from 'date-fns';

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
  onSelect: (date: Date, slot: AppointmentSlot, doctor: Doctor | null) => void;
  onBack?: () => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const AVATAR_COLORS = [
  'bg-sky-600',
  'bg-purple-600',
  'bg-teal-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-indigo-600',
];

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[parts.length - 2].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

function formatNextAvailable(dateStr: string | null): string {
  if (!dateStr) return 'Chưa có lịch';
  try {
    const date = new Date(dateStr);
    return formatDate(date, 'EEEE, dd/MM', { locale: vi });
  } catch {
    return 'Chưa xác định';
  }
}

function transformDoctorInfo(doc: DoctorInfo, index: number): Doctor {
  return {
    id: doc.doctor_id,
    name: doc.full_name || 'Bác sĩ',
    title: doc.specialty || '',
    specialties: doc.specialty || '',
    location: doc.facility_name || 'Phòng khám RCARE',
    nextAvailable: formatNextAvailable(doc.next_available),
    avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    initials: getInitials(doc.full_name || ''),
  };
}

const ANY_DOCTOR: Doctor = {
  id: 'any',
  name: 'Bác sĩ bất kỳ — Sớm nhất có thể',
  title: '',
  specialties: 'Hệ thống tự động chọn bác sĩ phù hợp, có lịch sớm nhất',
  location: '',
  nextAvailable: 'Lịch sớm nhất khả dụng',
  avatarColor: 'bg-slate-200',
  initials: '',
};

export default function BookingStep2({ specialty, onSelect, onBack }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([ANY_DOCTOR]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(ANY_DOCTOR);

  useEffect(() => {
    setLoadingDoctors(true);
    fetchDoctorsBySpecialty(specialty.id)
      .then((data) => {
        const transformedDoctors = data.map(transformDoctorInfo);
        setDoctors([ANY_DOCTOR, ...transformedDoctors]);
      })
      .catch(() => {
        setDoctors([ANY_DOCTOR]);
      })
      .finally(() => setLoadingDoctors(false));
  }, [specialty.id]);

  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setSlotError(null);
    setSelectedSlot(null);
    fetchSlots(specialty.id, date)
      .then(setSlots)
      .catch((e: Error) => setSlotError(e.message))
      .finally(() => setLoadingSlots(false));
  }, [date, specialty.id]);

  const morningSlots = slots.filter((s) => {
    const h = parseInt(s.start_time.split(':')[0] ?? '0', 10);
    return h < 12;
  });
  const afternoonSlots = slots.filter((s) => {
    const h = parseInt(s.start_time.split(':')[0] ?? '0', 10);
    return h >= 12;
  });

  function handleContinue() {
    if (!date || !selectedSlot) return;
    onSelect(date, selectedSlot, selectedDoctor);
  }

  function handlePrevMonth() {
    setCurrentMonth((m) => subMonths(m, 1));
  }

  function handleNextMonth() {
    setCurrentMonth((m) => addMonths(m, 1));
  }

  function handleSelectDate(d: Date) {
    if (isBefore(d, startOfToday()) || d.getDay() === 0) return;
    setDate(d);
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      {/* Left Column */}
      <div className="space-y-5">
        {/* Doctor Selection Card */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] p-5 shadow-sm">
          <h2 className="text-[20px] font-bold text-slate-800 tracking-[-0.3px] mb-1">
            Chọn bác sĩ phụ trách
          </h2>
          <p className="text-[14px] text-slate-500 mb-4">
            Nhu cầu đã chọn: <strong className="text-teal-600">{specialty.name}</strong>
          </p>

          <div className="space-y-3">
            {loadingDoctors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              </div>
            ) : doctors.map((doctor) => {
              const isSelected = selectedDoctor?.id === doctor.id;
              const isAnyDoctor = doctor.id === 'any';

              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => setSelectedDoctor(doctor)}
                  className={`w-full flex items-center gap-4 p-4 rounded-[14px] border-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50 shadow-[0_0_0_3px_rgba(2,132,199,0.15)]'
                      : 'border-slate-200 bg-white hover:border-sky-600 hover:shadow-sm'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0 ${
                      isAnyDoctor ? 'bg-slate-200' : doctor.avatarColor
                    }`}
                  >
                    {isAnyDoctor ? (
                      <Shuffle className="h-6 w-6 text-slate-500" />
                    ) : (
                      <span className="text-white text-lg font-bold">{doctor.initials}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-bold text-slate-800">{doctor.name}</div>
                    <div className="text-[14px] text-slate-500">
                      {isAnyDoctor ? doctor.specialties : `${doctor.title} · ${doctor.specialties}`}
                    </div>
                    {doctor.location && (
                      <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />
                        {doctor.location}
                      </div>
                    )}
                    <div className="text-[13px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {isAnyDoctor ? 'Lịch sớm nhất: ' : 'Giờ sớm nhất: '}
                      {doctor.nextAvailable}
                    </div>
                  </div>

                  {/* Check */}
                  {isSelected && (
                    <CheckCircle2 className="h-6 w-6 text-sky-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar Card */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-[18px] font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-teal-600" />
                Lịch đặt khám bệnh
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Chọn ngày khám trên lịch để xem khung giờ trống và đặt lịch trước
              </p>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-[10px]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-[30px] h-[30px] rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-extrabold text-[14px] text-slate-800 min-w-[100px] text-center">
                {format(currentMonth, 'MMMM, yyyy', { locale: vi })}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-[30px] h-[30px] rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Selected date badge */}
          {date && (
            <div className="flex items-center justify-end mb-3">
              <div className="text-[13px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Đang chọn: <b>{format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}</b>
              </div>
            </div>
          )}

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-[6px] mb-4">
            {/* Header days */}
            {WEEKDAYS.map((day, idx) => (
              <div
                key={day}
                className={`text-center font-bold text-[13px] py-1.5 ${
                  idx === 6 ? 'text-red-500' : 'text-slate-500'
                }`}
              >
                {day}
              </div>
            ))}

            {/* Padding cells for previous month */}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {/* Date cells */}
            {daysInMonth.map((d) => {
              const isPast = isBefore(d, startOfToday());
              const isSunday = d.getDay() === 0;
              const isDisabled = isPast || isSunday;
              const isSelected = date && isSameDay(d, date);
              const isCurrentMonth = isSameMonth(d, currentMonth);
              const availableSlots = Math.floor(Math.random() * 7) + 1;

              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(d)}
                  className={`
                    border-[1.5px] rounded-[8px] py-2.5 px-1 text-center transition-all duration-200 flex flex-col items-center justify-center gap-[3px] cursor-pointer select-none min-h-[58px]
                    ${!isCurrentMonth ? 'opacity-40' : ''}
                    ${
                      isDisabled
                        ? 'opacity-45 cursor-not-allowed bg-slate-50 border-slate-200'
                        : isSelected
                        ? 'border-teal-600 bg-teal-600 text-white shadow-[0_4px_10px_rgba(13,148,136,0.25)]'
                        : 'bg-white border-slate-200 hover:border-teal-600 hover:bg-teal-50'
                    }
                  `}
                >
                  <span
                    className={`text-[17px] font-extrabold leading-tight ${
                      isSelected ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                  {!isDisabled && (
                    <span
                      className={`text-[11.5px] font-bold leading-tight ${
                        isSelected ? 'text-white/90' : 'text-emerald-600'
                      }`}
                    >
                      {availableSlots} giờ trống
                    </span>
                  )}
                  {isPast && !isSunday && (
                    <span className="text-[11.5px] font-bold text-slate-400 leading-tight">Qua</span>
                  )}
                  {isSunday && (
                    <span className="text-[11.5px] font-bold text-slate-400 leading-tight">Hết</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="font-bold text-[14px] text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              Khung giờ khám khả dụng trong ngày:
            </span>
            {selectedSlot && (
              <span className="text-[13px] font-bold text-teal-600">
                Đã chọn: {formatSlotTime(selectedSlot.start_time)}
              </span>
            )}
          </div>

          {!date ? (
            <div className="flex items-center justify-center h-24 text-sm text-slate-500">
              Chọn một ngày để xem khung giờ trống
            </div>
          ) : loadingSlots ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            </div>
          ) : slotError ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {slotError}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Không có khung giờ nào trong ngày này.
            </p>
          ) : (
            <div className="space-y-3">
              <SlotGroup
                label="BUỔI SÁNG (08:00 – 11:30)"
                icon={<Sun className="h-4 w-4 text-amber-500" />}
                slots={morningSlots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />
              <SlotGroup
                label="BUỔI CHIỀU (13:30 – 17:00)"
                icon={<CloudSun className="h-4 w-4 text-sky-600" />}
                slots={afternoonSlots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />

              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-100 border border-slate-300 rounded-sm" />
                  Đã đầy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-teal-600 rounded-sm" />
                  Đang chọn
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-white border-[1.5px] border-slate-300 rounded-sm" />
                  Còn trống
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-full text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <button
            type="button"
            disabled={!selectedSlot}
            onClick={handleContinue}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full text-[16px] font-semibold transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 min-h-[48px] cursor-pointer"
          >
            Tiếp theo (Xác nhận đặt lịch)
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Right Column - Summary Panel */}
      <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] p-5 sticky top-[90px]">
        <div className="text-[12px] font-extrabold text-slate-500 uppercase tracking-[0.6px] mb-4">
          Tóm tắt lịch hẹn
        </div>

        <SummaryRow
          icon={<Stethoscope className="h-4 w-4" />}
          label="Dịch vụ"
          value={specialty.name}
        />
        <SummaryRow
          icon={<User className="h-4 w-4" />}
          label="Bác sĩ"
          value={selectedDoctor?.id === 'any' ? 'Bác sĩ sẵn sàng' : selectedDoctor?.name || '—'}
        />
        <SummaryRow
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Ngày khám"
          value={date ? format(date, 'EEEE, dd/MM/yyyy', { locale: vi }) : '—'}
        />
        <SummaryRow
          icon={<Clock className="h-4 w-4" />}
          label="Giờ khám"
          value={selectedSlot ? formatSlotTime(selectedSlot.start_time) : '—'}
          highlight
        />
        <SummaryRow
          icon={<MapPin className="h-4 w-4" />}
          label="Địa điểm"
          value="Phòng khám RCARE Quận 3"
          subValue="128 Nguyễn Đình Chiểu, P. Võ Thị Sáu"
        />

        <div className="mt-4 bg-teal-50 rounded-lg p-3 text-[13px] text-teal-700 font-semibold flex items-start gap-2">
          <span className="text-teal-600 mt-0.5">ℹ</span>
          <span>Vui lòng có mặt trước giờ khám 15 phút.</span>
        </div>
      </div>
    </div>
  );
}

type SlotGroupProps = {
  label: string;
  icon: React.ReactNode;
  slots: AppointmentSlot[];
  selected: AppointmentSlot | null;
  onSelect: (slot: AppointmentSlot) => void;
};

function SlotGroup({ label, icon, slots, selected, onSelect }: SlotGroupProps) {
  if (slots.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-[6px] text-[12px] font-bold text-slate-500 tracking-[0.5px] mb-2">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => {
          const isSelected = selected?.id === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!slot.is_available}
              onClick={() => onSelect(slot)}
              className={`
                px-3 py-2 rounded-lg border-[1.5px] text-[14px] font-semibold transition-all duration-200
                flex items-center gap-1.5 min-h-[40px] cursor-pointer
                ${
                  !slot.is_available
                    ? 'cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400 line-through'
                    : isSelected
                    ? 'border-teal-600 bg-teal-600 text-white font-bold shadow-[0_0_0_3px_rgba(13,148,136,0.2)]'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-teal-600 hover:text-teal-600 hover:bg-teal-50'
                }
              `}
            >
              <span className="font-semibold">
                {isSelected && '✓ '}
                {formatSlotTime(slot.start_time)}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  !slot.is_available
                    ? 'text-slate-400'
                    : isSelected
                    ? 'text-white/90'
                    : 'text-emerald-600'
                }`}
              >
                {slot.is_available ? (isSelected ? 'Đang chọn' : 'Còn') : 'Đầy'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type SummaryRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
};

function SummaryRow({ icon, label, value, subValue, highlight }: SummaryRowProps) {
  return (
    <div className="flex gap-[10px] py-[10px] border-b border-slate-100 last:border-b-0">
      <div className="w-5 text-slate-500 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[12px] font-semibold text-slate-500">{label}</div>
        <div
          className={`text-[14px] font-bold ${highlight ? 'text-teal-600' : 'text-slate-800'}`}
        >
          {value}
        </div>
        {subValue && <div className="text-[12px] text-slate-500">{subValue}</div>}
      </div>
    </div>
  );
}
