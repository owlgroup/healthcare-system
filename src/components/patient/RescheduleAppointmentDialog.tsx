import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameMonth,
  max as maxDate,
  parseISO,
  startOfMonth,
  startOfToday,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchRescheduleSlots,
  mapBookingError,
  rescheduleAppointment,
  type RescheduleSlot,
} from '@/lib/appointment-api';
import { formatSlotTime, getSession, type Appointment } from '@/types/appointment';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MAX_REASON_LENGTH = 500;
const REASON_PRESETS = [
  'Bận công việc đột xuất',
  'Lý do sức khỏe / đi lại',
  'Việc gia đình',
  'Muốn khám vào khung giờ khác',
];

type Props = {
  appointment: Appointment | null;
  onClose: () => void;
  onRescheduled: () => void;
};

export default function RescheduleAppointmentDialog({ appointment, onClose, onRescheduled }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<RescheduleSlot | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setMonth(startOfMonth(new Date()));
    setSelectedDate(null);
    setSelectedSlot(null);
    setReason('');
  }, [appointment]);

  useEffect(() => {
    if (!appointment) return;
    let ignore = false;
    const from = maxDate([month, startOfToday()]);
    setLoading(true);
    fetchRescheduleSlots(appointment.id, from, endOfMonth(month))
      .then((data) => {
        if (!ignore) setSlots(data);
      })
      .catch((e: Error) => {
        if (!ignore) {
          setSlots([]);
          toast.error(mapBookingError(e.message));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [appointment, month]);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, RescheduleSlot[]>();
    slots.forEach((slot) => {
      grouped.set(slot.slot_date, [...(grouped.get(slot.slot_date) ?? []), slot]);
    });
    return grouped;
  }, [slots]);

  const daySlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];
  const trimmedReason = reason.trim();
  const canSubmit = !!selectedSlot && trimmedReason.length > 0 && !submitting;

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
  }

  function handleReasonPreset(preset: string) {
    setReason((current) => (current.trim() ? `${current.trim()}. ${preset}` : preset));
  }

  async function handleSubmit() {
    if (!appointment || !selectedSlot || !trimmedReason) return;
    setSubmitting(true);
    try {
      await rescheduleAppointment({
        appointmentId: appointment.id,
        newSlotId: selectedSlot.slot_id,
        reason: trimmedReason,
      });
      toast.success('Đã đổi lịch hẹn thành công.');
      onRescheduled();
    } catch (e) {
      toast.error(mapBookingError((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  const isCurrentMonth = isSameMonth(month, new Date());
  const days = eachDayOfInterval({ start: month, end: endOfMonth(month) });
  const firstDow = getDay(month);
  const paddingDays = firstDow === 0 ? 6 : firstDow - 1;

  return (
    <Dialog
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent className="max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[20px]">
            <CalendarClock className="h-5 w-5 text-teal-600" />
            Đổi lịch hẹn khám
          </DialogTitle>
          <DialogDescription>
            Chỉ hiển thị các khung giờ còn trống trong lịch làm việc của bác sĩ phụ trách.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center gap-3 text-[14px]">
            <div>
              <div className="text-[12px] font-semibold text-slate-500">Lịch hiện tại</div>
              <div className="font-bold text-slate-700">
                Khám {appointment.specialty_name} ·{' '}
                {format(parseISO(appointment.slot_date), 'EEEE, dd/MM/yyyy', { locale: vi })} (
                {formatSlotTime(appointment.start_time)})
              </div>
            </div>
            {selectedSlot && (
              <>
                <ArrowRight className="h-4 w-4 text-teal-600" />
                <div>
                  <div className="text-[12px] font-semibold text-slate-500">Lịch mới</div>
                  <div className="font-bold text-teal-700">
                    {format(parseISO(selectedSlot.slot_date), 'EEEE, dd/MM/yyyy', { locale: vi })} (
                    {formatSlotTime(selectedSlot.start_time)})
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800">1. Chọn ngày khám mới</h4>
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-[10px]">
              <button
                type="button"
                aria-label="Tháng trước"
                disabled={isCurrentMonth || loading}
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="w-[30px] h-[30px] rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-extrabold text-[14px] text-slate-800 min-w-[110px] text-center capitalize">
                {format(month, 'MMMM, yyyy', { locale: vi })}
              </span>
              <button
                type="button"
                aria-label="Tháng sau"
                disabled={loading}
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="w-[30px] h-[30px] rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              </div>
            )}
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  className={`text-center font-bold text-[12px] py-1 ${idx === 6 ? 'text-red-500' : 'text-slate-500'}`}
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: paddingDays }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const freeCount = slotsByDate.get(dateKey)?.length ?? 0;
                const isPast = isBefore(day, startOfToday());
                const isDisabled = isPast || freeCount === 0;
                const isSelected = selectedDate === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDate(dateKey)}
                    className={`border-[1.5px] rounded-lg py-1.5 flex flex-col items-center gap-0.5 min-h-[52px] transition-colors ${
                      isDisabled
                        ? 'opacity-45 cursor-not-allowed bg-slate-50 border-slate-200'
                        : isSelected
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'bg-white border-slate-200 hover:border-teal-600 hover:bg-teal-50'
                    }`}
                  >
                    <span className={`text-[15px] font-extrabold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {format(day, 'd')}
                    </span>
                    <span
                      className={`text-[10.5px] font-bold ${
                        isSelected ? 'text-white/90' : isDisabled ? 'text-slate-400' : 'text-emerald-600'
                      }`}
                    >
                      {isPast ? 'Qua' : freeCount > 0 ? `${freeCount} giờ trống` : 'Không lịch'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {!loading && slots.length === 0 && (
            <p className="mt-3 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Bác sĩ không còn giờ trống trong tháng này. Vui lòng xem tháng tiếp theo.
            </p>
          )}
        </section>

        <section>
          <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" />
            2. Chọn giờ khám
          </h4>
          {!selectedDate ? (
            <p className="text-sm text-slate-500">Chọn một ngày để xem khung giờ trống.</p>
          ) : (
            <div className="space-y-3">
              {(['morning', 'afternoon'] as const).map((session) => {
                const sessionSlots = daySlots.filter((s) => getSession(s.start_time) === session);
                if (sessionSlots.length === 0) return null;
                return (
                  <div key={session}>
                    <div className="text-[12px] font-bold text-slate-500 mb-1.5">
                      {session === 'morning' ? 'BUỔI SÁNG' : 'BUỔI CHIỀU'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionSlots.map((slot) => {
                        const isSelected = selectedSlot?.slot_id === slot.slot_id;
                        return (
                          <button
                            key={slot.slot_id}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-2 rounded-lg border-[1.5px] text-[14px] font-semibold min-h-[40px] transition-colors ${
                              isSelected
                                ? 'border-teal-600 bg-teal-600 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-teal-600 hover:text-teal-600 hover:bg-teal-50'
                            }`}
                          >
                            {formatSlotTime(slot.start_time)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <label htmlFor="reschedule-reason" className="font-bold text-slate-800 block mb-2">
            3. Lý do đổi lịch <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleReasonPreset(preset)}
                className="px-3 py-1 rounded-full text-[12.5px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
              >
                {preset}
              </button>
            ))}
          </div>
          <Textarea
            id="reschedule-reason"
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do bạn muốn đổi lịch hẹn..."
            rows={3}
          />
          <div className="text-right text-[12px] text-slate-400 mt-1">
            {reason.length}/{MAX_REASON_LENGTH}
          </div>
        </section>

        <p className="text-[12.5px] text-slate-500">
          Chỉ có thể đổi lịch trước giờ khám ít nhất 2 tiếng. Khung giờ cũ sẽ được giải phóng sau khi đổi.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Xác nhận đổi lịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
