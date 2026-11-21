import { useMemo, useState } from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_LABELS, type AppointmentStatus } from '@/types/appointment';
import type { Doctor } from '@/types/master-data';

export type PatientFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  doctorId?: string;
};

type PatientListFiltersProps = {
  doctors: Doctor[];
  currentDoctorId?: string | null;
  isAdmin?: boolean;
  isLoading?: boolean;
  onFilter: (filters: PatientFilters) => void;
  onReset: () => void;
};

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

const FIELD_LABEL_CLASS = 'whitespace-nowrap text-xs font-medium text-[#4A4440]';
const CONTROL_CLASS =
  'h-9 rounded-lg border-[#E1DDDA] bg-[#FAF9F8] text-[#1A1614] shadow-none focus-visible:ring-[#C41740]/30';

function formatChipDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function PatientListFilters({
  doctors,
  currentDoctorId,
  isAdmin = false,
  isLoading = false,
  onFilter,
  onReset,
}: PatientListFiltersProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<string>('__all__');
  const [doctorId, setDoctorId] = useState<string>(
    isAdmin ? '__all__' : (currentDoctorId ?? '__all__')
  );
  const [applied, setApplied] = useState<PatientFilters>({});

  const publish = (next: PatientFilters, draft: {
    dateFrom: string;
    dateTo: string;
    status: string;
    doctorId: string;
  }) => {
    setDateFrom(draft.dateFrom);
    setDateTo(draft.dateTo);
    setStatus(draft.status);
    setDoctorId(draft.doctorId);
    setApplied(next);
    onFilter(next);
  };

  const handleFilter = () => {
    publish(
      {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status !== '__all__' ? status : undefined,
        doctorId: doctorId !== '__all__' ? doctorId : undefined,
      },
      { dateFrom, dateTo, status, doctorId },
    );
  };

  const handleReset = () => {
    const nextDoctor = isAdmin ? '__all__' : (currentDoctorId ?? '__all__');
    setDateFrom('');
    setDateTo('');
    setStatus('__all__');
    setDoctorId(nextDoctor);
    setApplied({});
    onReset();
  };

  const currentDoctorLabel = useMemo(() => {
    const current = doctors.find((d) => d.user_id === currentDoctorId);
    return current?.full_name ?? current?.email ?? 'Bạn';
  }, [doctors, currentDoctorId]);

  const chips = useMemo(() => {
    const items: { key: string; label: string; value: string; onRemove: () => void }[] = [];
    if (applied.dateFrom) {
      items.push({
        key: 'from',
        label: 'Từ ngày',
        value: formatChipDate(applied.dateFrom),
        onRemove: () =>
          publish(
            { ...applied, dateFrom: undefined },
            { dateFrom: '', dateTo, status, doctorId },
          ),
      });
    }
    if (applied.dateTo) {
      items.push({
        key: 'to',
        label: 'Đến ngày',
        value: formatChipDate(applied.dateTo),
        onRemove: () =>
          publish(
            { ...applied, dateTo: undefined },
            { dateFrom, dateTo: '', status, doctorId },
          ),
      });
    }
    if (applied.status && applied.status in STATUS_LABELS) {
      items.push({
        key: 'status',
        label: 'Trạng thái',
        value: STATUS_LABELS[applied.status as AppointmentStatus],
        onRemove: () =>
          publish(
            { ...applied, status: undefined },
            { dateFrom, dateTo, status: '__all__', doctorId },
          ),
      });
    }
    if (isAdmin && applied.doctorId) {
      const doctor = doctors.find((item) => item.user_id === applied.doctorId);
      items.push({
        key: 'doctor',
        label: 'Bác sĩ',
        value: doctor?.full_name ?? doctor?.email ?? 'Đã chọn',
        onRemove: () =>
          publish(
            { ...applied, doctorId: undefined },
            { dateFrom, dateTo, status, doctorId: '__all__' },
          ),
      });
    }
    return items;
  }, [applied, dateFrom, dateTo, status, doctorId, doctors, isAdmin]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#E8E5E2] bg-white px-4 py-3">
        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>Ngày khám</span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Từ ngày"
              className={CONTROL_CLASS}
            />
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Đến ngày"
              className={CONTROL_CLASS}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>Trạng thái lịch hẹn</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={CONTROL_CLASS} aria-label="Trạng thái lịch hẹn">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả</SelectItem>
              {APPOINTMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isAdmin && doctors.length > 0 ? (
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Bác sĩ phụ trách</span>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className={CONTROL_CLASS} aria-label="Bác sĩ phụ trách">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.user_id} value={d.user_id}>
                    {d.full_name ?? d.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!isAdmin && currentDoctorId ? (
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Bác sĩ phụ trách</span>
            <div className="flex h-9 items-center truncate rounded-lg border border-[#E1DDDA] bg-[#F0EEEC] px-3 text-sm text-[#7A726D]">
              {currentDoctorLabel}
            </div>
          </div>
        ) : null}

        <div className="flex flex-none gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 cursor-pointer rounded-lg border-[#D9D5D1] bg-white font-semibold text-[#1A1614] hover:bg-[#FAF9F8]"
            onClick={handleReset}
            disabled={isLoading}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Đặt lại
          </Button>
          <Button
            type="button"
            className="h-9 cursor-pointer rounded-lg bg-[#C41740] font-semibold text-white hover:bg-[#A8123A]"
            onClick={handleFilter}
            disabled={isLoading}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Lọc
          </Button>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[#E1DDDA] bg-white pl-2.5 pr-1 text-xs"
            >
              <span className="text-[#7A726D]">{chip.label}:</span>
              <span className="font-semibold text-[#1A1614]">{chip.value}</span>
              <button
                type="button"
                className="grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full bg-[#F0EEEC] text-[#57524E] transition-colors duration-200 hover:bg-[#E8E5E2]"
                aria-label={`Bỏ lọc ${chip.label}`}
                onClick={chip.onRemove}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="h-[26px] cursor-pointer px-2 text-xs font-semibold text-[#C41740] transition-colors duration-200 hover:text-[#A8123A]"
            onClick={handleReset}
          >
            Xóa tất cả
          </button>
        </div>
      ) : null}
    </div>
  );
}
