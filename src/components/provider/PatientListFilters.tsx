import { useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
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

const FIELD_LABEL_CLASS = 'text-xs font-medium text-foreground/80 whitespace-nowrap';

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

  const handleFilter = () => {
    onFilter({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: status !== '__all__' ? status : undefined,
      doctorId: doctorId !== '__all__' ? doctorId : undefined,
    });
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setStatus('__all__');
    setDoctorId(isAdmin ? '__all__' : (currentDoctorId ?? '__all__'));
    onReset();
  };

  const currentDoctorLabel = useMemo(() => {
    const current = doctors.find((d) => d.user_id === currentDoctorId);
    return current?.full_name ?? current?.email ?? 'Bạn';
  }, [doctors, currentDoctorId]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-1.5">
        <span className={FIELD_LABEL_CLASS}>Ngày khám</span>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Từ ngày"
            className="h-9 bg-muted/40"
          />
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Đến ngày"
            className="h-9 bg-muted/40"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
        <span className={FIELD_LABEL_CLASS}>Trạng thái lịch hẹn</span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 bg-muted/40" aria-label="Trạng thái lịch hẹn">
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
            <SelectTrigger className="h-9 bg-muted/40" aria-label="Bác sĩ phụ trách">
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
          <div className="flex h-9 items-center truncate rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            {currentDoctorLabel}
          </div>
        </div>
      ) : null}

      <div className="flex flex-none gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 cursor-pointer"
          onClick={handleReset}
          disabled={isLoading}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Đặt lại
        </Button>
        <Button
          type="button"
          className="h-9 cursor-pointer"
          onClick={handleFilter}
          disabled={isLoading}
        >
          <Search className="mr-1.5 h-4 w-4" />
          Lọc
        </Button>
      </div>
    </div>
  );
}
