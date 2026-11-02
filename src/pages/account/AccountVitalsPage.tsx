import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplet,
  Heart,
  Loader2,
  Scale,
  Thermometer,
  Wind,
} from 'lucide-react';
import { formatVitalDate, getMyVitalsSummary } from '@/lib/patient-vitals-api';
import type { VitalsSummary } from '@/types/patient-account';
import { cn } from '@/lib/utils';
import { VitalDetailModal } from '@/components/patient/VitalDetailModal';

type VitalType = 'bp' | 'hr' | 'bmi' | 'spo2' | 'glucose' | 'temp';

type VitalCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  statusBadge?: string | null;
  statusColor?: 'green' | 'blue' | 'yellow' | 'red';
  mainValue: string;
  unit: string;
  valueColor?: string;
  dateText?: string | null;
  noteText?: string | null;
  onClick?: () => void;
};

function VitalCard({
  icon,
  iconBg,
  iconColor,
  title,
  statusBadge,
  statusColor = 'green',
  mainValue,
  unit,
  valueColor,
  dateText,
  noteText,
  onClick,
}: VitalCardProps) {
  const statusColorMap = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    blue: 'bg-sky-50 text-sky-600 border-sky-200',
    yellow: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-rose-50 text-rose-600 border-rose-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer flex-col rounded-xl border-[1.5px] border-border bg-white p-[18px] text-left transition-all duration-200 hover:border-teal-500 hover:shadow-[0_4px_12px_rgba(13,148,136,0.12)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-[38px] w-[38px] items-center justify-center rounded-[10px]',
              iconBg,
              iconColor
            )}
          >
            {icon}
          </div>
          <span className="text-base font-bold text-foreground">{title}</span>
        </div>
        {statusBadge && (
          <span
            className={cn(
              'rounded-xl border px-2 py-0.5 text-[11.5px] font-bold',
              statusColorMap[statusColor]
            )}
          >
            {statusBadge}
          </span>
        )}
      </div>

      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span
          className={cn('text-[26px] font-extrabold', valueColor || 'text-foreground')}
        >
          {mainValue}
        </span>
        <span className="text-[13.5px] font-semibold text-muted-foreground">{unit}</span>
      </div>

      <div className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {dateText || '—'}
          {noteText ? ` · ${noteText}` : ''}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="text-[12.5px] font-bold text-teal-600">Xem chi tiết chỉ số</span>
        <ChevronRight className="h-3 w-3 text-teal-600" />
      </div>
    </button>
  );
}

function getStatusBadgeInfo(
  value: number | null,
  type: 'bp' | 'hr' | 'bmi' | 'spo2' | 'glucose' | 'temp'
): { badge: string | null; color: 'green' | 'blue' | 'yellow' | 'red' } {
  if (value == null) return { badge: null, color: 'green' };

  switch (type) {
    case 'bp':
      if (value <= 120) return { badge: 'Tối ưu', color: 'green' };
      if (value < 140) return { badge: 'Bình thường', color: 'green' };
      return { badge: 'Cao', color: 'yellow' };
    case 'hr':
      if (value >= 60 && value <= 100) return { badge: 'Bình thường', color: 'green' };
      return { badge: 'Cần theo dõi', color: 'yellow' };
    case 'bmi':
      if (value < 18.5) return { badge: `BMI ${value} · Thiếu cân`, color: 'yellow' };
      if (value < 25) return { badge: `BMI ${value} · Chuẩn`, color: 'green' };
      if (value < 30) return { badge: `BMI ${value} · Thừa cân`, color: 'yellow' };
      return { badge: `BMI ${value} · Béo phì`, color: 'red' };
    case 'spo2':
      if (value >= 95) return { badge: 'Rất tốt', color: 'green' };
      if (value >= 90) return { badge: 'Bình thường', color: 'green' };
      return { badge: 'Thấp', color: 'red' };
    case 'glucose':
      if (value >= 70 && value <= 100) return { badge: 'Bình thường', color: 'green' };
      return { badge: 'Cần kiểm tra', color: 'yellow' };
    case 'temp':
      if (value >= 36 && value <= 37.5) return { badge: 'Ổn định', color: 'green' };
      if (value > 37.5) return { badge: 'Sốt nhẹ', color: 'yellow' };
      return { badge: 'Hạ thân nhiệt', color: 'blue' };
    default:
      return { badge: null, color: 'green' };
  }
}

function VitalsHeader({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <div className="mb-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">
            Bảng theo dõi chỉ số sinh hiệu
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dữ liệu sinh hiệu được đo lường và ghi nhận trực tiếp bởi Bác sĩ & Điều dưỡng
            phòng khám. Bấm vào từng chỉ số để xem chi tiết lịch sử và phân tích.
          </p>
        </div>
        {lastUpdated && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Cập nhật gần nhất: {lastUpdated}
          </span>
        )}
      </div>
    </div>
  );
}

function VitalsGrid({
  summary,
  onCardClick,
}: {
  summary: VitalsSummary;
  onCardClick: (type: VitalType, value: string, date: string) => void;
}) {
  const bpValue =
    summary.blood_pressure.systolic != null && summary.blood_pressure.diastolic != null
      ? `${summary.blood_pressure.systolic}/${summary.blood_pressure.diastolic}`
      : '—';

  const bpStatus = getStatusBadgeInfo(summary.blood_pressure.systolic, 'bp');

  const hrValue = '—';
  const hrStatus = getStatusBadgeInfo(null, 'hr');

  const weightValue = summary.weight.kg != null ? String(summary.weight.kg) : '—';
  const heightValue = summary.height.cm != null ? String(summary.height.cm) : '—';
  const bmiStatus = getStatusBadgeInfo(summary.height.bmi, 'bmi');

  const spo2Value = '—';
  const spo2Status = getStatusBadgeInfo(null, 'spo2');

  const glucoseValue = '—';
  const glucoseStatus = getStatusBadgeInfo(null, 'glucose');

  const tempValue = summary.temperature.celsius != null ? String(summary.temperature.celsius) : '—';
  const tempStatus = getStatusBadgeInfo(summary.temperature.celsius, 'temp');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <VitalCard
        icon={<Heart className="h-[18px] w-[18px]" />}
        iconBg="bg-rose-100"
        iconColor="text-rose-500"
        title="Huyết áp"
        statusBadge={bpStatus.badge}
        statusColor={bpStatus.color}
        mainValue={bpValue}
        unit="mmHg"
        dateText={formatVitalDate(summary.blood_pressure.recorded_at)}
        noteText={summary.blood_pressure.source === 'clinic' ? 'Đo tại phòng khám' : undefined}
        onClick={() => onCardClick('bp', bpValue, formatVitalDate(summary.blood_pressure.recorded_at))}
      />

      <VitalCard
        icon={<Activity className="h-[18px] w-[18px]" />}
        iconBg="bg-pink-100"
        iconColor="text-pink-500"
        title="Nhịp tim"
        statusBadge={hrStatus.badge}
        statusColor={hrStatus.color}
        mainValue={hrValue}
        unit="nhịp/phút (bpm)"
        dateText={null}
        noteText={hrValue !== '—' ? 'Nhịp xoang đều' : undefined}
        onClick={() => onCardClick('hr', hrValue, '—')}
      />

      <VitalCard
        icon={<Scale className="h-[18px] w-[18px]" />}
        iconBg="bg-indigo-100"
        iconColor="text-indigo-500"
        title="Cân nặng & BMI"
        statusBadge={bmiStatus.badge}
        statusColor={bmiStatus.color}
        mainValue={weightValue}
        unit={`kg${heightValue !== '—' ? ` · ${heightValue} cm` : ''}`}
        dateText={formatVitalDate(summary.weight.recorded_at)}
        noteText={summary.height.bmi_status || undefined}
        onClick={() => onCardClick('bmi', weightValue, formatVitalDate(summary.weight.recorded_at))}
      />

      <VitalCard
        icon={<Wind className="h-[18px] w-[18px]" />}
        iconBg="bg-teal-100"
        iconColor="text-teal-500"
        title="Oxy trong máu (SpO2)"
        statusBadge={spo2Status.badge}
        statusColor={spo2Status.color}
        mainValue={spo2Value}
        unit="%"
        valueColor={spo2Value !== '—' ? 'text-teal-600' : undefined}
        dateText={null}
        noteText={spo2Value !== '—' ? 'Đo khí phòng' : undefined}
        onClick={() => onCardClick('spo2', spo2Value, '—')}
      />

      <VitalCard
        icon={<Droplet className="h-[18px] w-[18px]" />}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        title="Đường huyết lúc đói"
        statusBadge={glucoseStatus.badge}
        statusColor={glucoseStatus.color}
        mainValue={glucoseValue}
        unit="mg/dL"
        dateText={null}
        noteText={glucoseValue !== '—' ? 'Nhịn ăn > 8 giờ' : undefined}
        onClick={() => onCardClick('glucose', glucoseValue, '—')}
      />

      <VitalCard
        icon={<Thermometer className="h-[18px] w-[18px]" />}
        iconBg="bg-orange-100"
        iconColor="text-orange-500"
        title="Thân nhiệt"
        statusBadge={tempStatus.badge}
        statusColor={tempStatus.color}
        mainValue={tempValue}
        unit="°C"
        dateText={formatVitalDate(summary.temperature.recorded_at)}
        noteText={tempValue !== '—' ? 'Nhiệt kế hồng ngoại' : undefined}
        onClick={() => onCardClick('temp', tempValue, formatVitalDate(summary.temperature.recorded_at))}
      />
    </div>
  );
}

const AccountVitalsPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVital, setSelectedVital] = useState<{
    type: VitalType;
    value: string;
    date: string;
  } | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['patient', 'vitals-summary'],
    queryFn: getMyVitalsSummary,
  });

  const lastUpdatedDate = summary?.blood_pressure.recorded_at
    ? formatVitalDate(summary.blood_pressure.recorded_at)
    : summary?.weight.recorded_at
      ? formatVitalDate(summary.weight.recorded_at)
      : summary?.temperature.recorded_at
        ? formatVitalDate(summary.temperature.recorded_at)
        : null;

  const handleCardClick = (type: VitalType, value: string, date: string) => {
    setSelectedVital({ type, value, date });
    setModalOpen(true);
  };

  return (
    <section className="mx-auto" style={{ maxWidth: 1168 }}>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : summary ? (
        <>
          <VitalsHeader lastUpdated={lastUpdatedDate} />
          <VitalsGrid summary={summary} onCardClick={handleCardClick} />
        </>
      ) : (
        <div className="flex justify-center py-16 text-muted-foreground">
          Không có dữ liệu chỉ số sinh hiệu
        </div>
      )}

      {selectedVital && (
        <VitalDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          vitalType={selectedVital.type}
          currentValue={selectedVital.value}
          lastReadingDate={selectedVital.date}
        />
      )}
    </section>
  );
};

export default AccountVitalsPage;
