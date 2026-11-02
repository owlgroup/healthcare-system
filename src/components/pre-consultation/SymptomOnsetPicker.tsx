/**
 * SymptomOnsetPicker — Date/time picker for symptom onset
 * Allows selection of date + hour + minute (15-min intervals)
 * Clinic hours: 07:00 - 20:00
 *
 * Stores value as "dd/MM/yyyy HH:mm" string format for display,
 * but the parent form may convert this to duration for API storage.
 */

import { useState, useEffect } from 'react';
import { format, isValid, differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SymptomOnsetValue = {
  date: Date | null;
  hour: number | null;
  minute: number | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const CLINIC_HOURS = Array.from({ length: 14 }, (_, i) => 7 + i);
const MINUTE_OPTIONS = [0, 15, 30, 45];

function parseOnsetValue(value: string): SymptomOnsetValue {
  if (!value || value === 'Không rõ') {
    return { date: null, hour: null, minute: null };
  }

  const dateTimeMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (dateTimeMatch) {
    const [, day, month, year, hour, minute] = dateTimeMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (isValid(date)) {
      return {
        date,
        hour: Number(hour),
        minute: Number(minute),
      };
    }
  }

  const dateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (isValid(date)) {
      return { date, hour: null, minute: null };
    }
  }

  return { date: null, hour: null, minute: null };
}

function formatOnsetValue(onset: SymptomOnsetValue): string {
  if (!onset.date) return 'Không rõ';

  const dateStr = format(onset.date, 'dd/MM/yyyy', { locale: vi });

  if (onset.hour != null && onset.minute != null) {
    const hourStr = String(onset.hour).padStart(2, '0');
    const minuteStr = String(onset.minute).padStart(2, '0');
    return `${dateStr} ${hourStr}:${minuteStr}`;
  }

  return dateStr;
}

function calculateDurationText(date: Date | null): string {
  if (!date) return '';

  const now = new Date();
  const days = differenceInDays(now, date);
  const weeks = differenceInWeeks(now, date);
  const months = differenceInMonths(now, date);

  if (months >= 1) {
    return `${months} tháng`;
  }
  if (weeks >= 1) {
    return `${weeks} tuần`;
  }
  if (days >= 1) {
    return `${days} ngày`;
  }
  return 'Hôm nay';
}

export default function SymptomOnsetPicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'Chọn ngày giờ',
}: Props) {
  const parsed = parseOnsetValue(value);
  const [date, setDate] = useState<Date | undefined>(parsed.date ?? undefined);
  const [hour, setHour] = useState<string>(parsed.hour != null ? String(parsed.hour) : '');
  const [minute, setMinute] = useState<string>(parsed.minute != null ? String(parsed.minute) : '');
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const newParsed = parseOnsetValue(value);
    setDate(newParsed.date ?? undefined);
    setHour(newParsed.hour != null ? String(newParsed.hour) : '');
    setMinute(newParsed.minute != null ? String(newParsed.minute) : '');
  }, [value]);

  const durationText = calculateDurationText(date ?? null);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const newOnset: SymptomOnsetValue = {
        date: selectedDate,
        hour: hour ? Number(hour) : null,
        minute: minute ? Number(minute) : null,
      };
      onChange(formatOnsetValue(newOnset));
    } else {
      onChange('Không rõ');
    }
    setCalendarOpen(false);
  };

  const handleHourChange = (h: string) => {
    setHour(h);
    if (!date) return;
    const newOnset: SymptomOnsetValue = {
      date,
      hour: h ? Number(h) : null,
      minute: minute ? Number(minute) : null,
    };
    onChange(formatOnsetValue(newOnset));
  };

  const handleMinuteChange = (m: string) => {
    setMinute(m);
    if (!date) return;
    const newOnset: SymptomOnsetValue = {
      date,
      hour: hour ? Number(hour) : null,
      minute: m ? Number(m) : null,
    };
    onChange(formatOnsetValue(newOnset));
  };

  const displayValue = date
    ? format(date, 'dd/MM/yyyy', { locale: vi })
    : placeholder;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Ngày</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  'w-full justify-start text-left font-normal h-10',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayValue}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                locale={vi}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Giờ</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                value={hour}
                onValueChange={handleHourChange}
                disabled={disabled || !date}
              >
                <SelectTrigger className="h-10">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="giờ" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, '0')} giờ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Select
                value={minute}
                onValueChange={handleMinuteChange}
                disabled={disabled || !date || !hour}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="phút" />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {String(m).padStart(2, '0')} phút
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {durationText && (
        <p className="text-xs text-muted-foreground">
          Thời gian triệu chứng: <span className="font-medium text-foreground">{durationText}</span>
        </p>
      )}
    </div>
  );
}
