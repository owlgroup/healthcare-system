import { X, TrendingUp, Stethoscope } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

type VitalType = 'bp' | 'hr' | 'bmi' | 'spo2' | 'glucose' | 'temp';

type VitalReading = {
  date: string;
  time: string;
  value: string;
  location: string;
  status: string;
  statusColor: 'green' | 'yellow' | 'red';
};

type VitalDetailData = {
  type: VitalType;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  currentValue: string;
  unit: string;
  unitSecondary?: string;
  lastReadingDate: string;
  statusBadge: string;
  statusColor: 'green' | 'yellow' | 'red';
  referenceText: string;
  trend: string;
  trendColor: 'green' | 'yellow' | 'red';
  history: VitalReading[];
  doctorNote?: string;
};

const VITAL_CONFIG: Record<VitalType, Omit<VitalDetailData, 'currentValue' | 'lastReadingDate' | 'history' | 'doctorNote'>> = {
  bp: {
    type: 'bp',
    icon: <span className="text-lg">❤️</span>,
    iconBg: 'bg-rose-100',
    title: 'Huyết áp (Blood Pressure)',
    subtitle: 'Áp lực máu lên thành động mạch khi tim co bóp và nghỉ',
    unit: 'mmHg',
    statusBadge: 'Huyết áp tối ưu',
    statusColor: 'green',
    referenceText: 'Khoảng tham chiếu: Tâm thu < 120 mmHg, Tâm trương < 80 mmHg. Chỉ số trong ngưỡng khỏe mạnh.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
  hr: {
    type: 'hr',
    icon: <span className="text-lg">💓</span>,
    iconBg: 'bg-pink-100',
    title: 'Nhịp tim (Heart Rate)',
    subtitle: 'Số lần tim đập trong một phút khi nghỉ ngơi',
    unit: 'bpm',
    unitSecondary: 'nhịp/phút',
    statusBadge: 'Nhịp tim bình thường',
    statusColor: 'green',
    referenceText: 'Khoảng tham chiếu: 60 – 100 bpm khi nghỉ ngơi. Nhịp xoang đều, không có rối loạn.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
  bmi: {
    type: 'bmi',
    icon: <span className="text-lg">⚖️</span>,
    iconBg: 'bg-indigo-100',
    title: 'Cân nặng & BMI (Body Mass Index)',
    subtitle: 'Chỉ số khối cơ thể đánh giá tình trạng dinh dưỡng',
    unit: 'kg',
    unitSecondary: 'BMI',
    statusBadge: 'Cân nặng bình thường',
    statusColor: 'green',
    referenceText: 'BMI 18.5 – 24.9 là bình thường. Duy trì chế độ ăn uống và vận động hợp lý.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
  spo2: {
    type: 'spo2',
    icon: <span className="text-lg">🫁</span>,
    iconBg: 'bg-teal-100',
    title: 'Oxy trong máu (SpO2)',
    subtitle: 'Nồng độ oxy bão hòa trong máu động mạch',
    unit: '%',
    statusBadge: 'Mức oxy rất tốt',
    statusColor: 'green',
    referenceText: 'Khoảng tham chiếu: 95 – 100%. Dưới 90% cần theo dõi y tế ngay.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
  glucose: {
    type: 'glucose',
    icon: <span className="text-lg">🩸</span>,
    iconBg: 'bg-amber-100',
    title: 'Đường huyết lúc đói (Fasting Glucose)',
    subtitle: 'Nồng độ glucose huyết tương sau nhịn ăn ít nhất 8 tiếng',
    unit: 'mg/dL',
    unitSecondary: 'mmol/L',
    statusBadge: 'Mức đường huyết bình thường',
    statusColor: 'green',
    referenceText: 'Khoảng tham chiếu chuẩn lúc đói: 70 – 99 mg/dL (3.9 – 5.5 mmol/L). Không có nguy cơ tiền đái tháo đường.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
  temp: {
    type: 'temp',
    icon: <span className="text-lg">🌡️</span>,
    iconBg: 'bg-orange-100',
    title: 'Thân nhiệt (Body Temperature)',
    subtitle: 'Nhiệt độ cơ thể đo bằng nhiệt kế hồng ngoại',
    unit: '°C',
    statusBadge: 'Thân nhiệt ổn định',
    statusColor: 'green',
    referenceText: 'Khoảng tham chiếu: 36.1 – 37.2°C. Trên 37.5°C được xem là sốt nhẹ.',
    trend: 'Xu hướng ổn định',
    trendColor: 'green',
  },
};

function VitalLineChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  if (data.length === 0) return null;

  return (
    <div className="h-[200px] w-full rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            formatter={(value: number) => [`${value} ${unit}`, 'Giá trị']}
            labelFormatter={(label) => `Ngày: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#colorValue)"
            dot={{ fill: '#fff', stroke: '#f97316', strokeWidth: 2, r: 5 }}
            activeDot={{ fill: '#f97316', stroke: '#fff', strokeWidth: 2, r: 7 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vitalType: VitalType;
  currentValue?: string;
  lastReadingDate?: string;
};

export function VitalDetailModal({
  open,
  onOpenChange,
  vitalType,
  currentValue = '—',
  lastReadingDate = '—',
}: Props) {
  const config = VITAL_CONFIG[vitalType];

  const mockHistory: VitalReading[] = [
    { date: '14/10/2025', time: '08:30', value: '92 mg/dL (5.1 mmol/L)', location: 'Khoa Xét nghiệm · Phòng khám RCare', status: 'Bình thường', statusColor: 'green' },
    { date: '15/04/2025', time: '08:15', value: '90 mg/dL (5.0 mmol/L)', location: 'Khoa Xét nghiệm · Phòng khám RCare', status: 'Bình thường', statusColor: 'green' },
    { date: '10/10/2024', time: '09:00', value: '94 mg/dL (5.2 mmol/L)', location: 'Khoa Xét nghiệm · Phòng khám RCare', status: 'Bình thường', statusColor: 'green' },
  ];

  const chartData = [
    { label: '10/10/24', value: 94 },
    { label: '15/04/25', value: 90 },
    { label: '14/10/25', value: 92 },
  ];

  const statusColorMap = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-rose-50 text-rose-600 border-rose-200',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', config.iconBg)}>
                {config.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{config.title}</h2>
                <p className="text-sm text-slate-500">{config.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {/* Current Reading */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Lần đo gần nhất ({lastReadingDate}):
              </span>
              <span className={cn('rounded-full border px-3 py-1 text-xs font-bold', statusColorMap[config.statusColor])}>
                ✓ {config.statusBadge}
              </span>
            </div>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-800">{currentValue}</span>
              <span className="text-lg font-semibold text-slate-500">{config.unit}</span>
              {config.unitSecondary && (
                <span className="text-sm text-slate-400">({config.unitSecondary})</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{config.referenceText}</p>
          </div>

          {/* Chart Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">
                  Biểu đồ diễn tiến số liệu qua các lần khám
                </span>
              </div>
              <span className={cn('rounded-lg border px-2.5 py-1 text-xs font-bold', statusColorMap[config.trendColor])}>
                ↗ {config.trend}
              </span>
            </div>
            <VitalLineChart data={chartData} unit={config.unit} />
          </div>

          {/* History Table */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                ☰ Bảng dữ liệu các lần đo đã khám
              </span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Thời gian đo</th>
                    <th className="px-5 py-3">Giá trị & Địa điểm</th>
                    <th className="px-5 py-3 text-right">Đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockHistory.map((reading, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-sm font-semibold text-slate-700">
                        {reading.date} ({reading.time})
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm font-semibold text-teal-600">{reading.value}</div>
                        <div className="text-xs text-slate-500">{reading.location}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn('rounded-md px-2 py-1 text-xs font-bold', statusColorMap[reading.statusColor])}>
                          {reading.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Doctor's Note */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100">
              <Stethoscope className="h-4 w-4 text-sky-600" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-bold text-slate-700">Nhận xét của Bác sĩ: </span>
              <span className="text-sm text-slate-600">
                Chỉ số đường huyết chuyển hóa tốt, chức năng tụy bình thường.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-white px-6 py-4">
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} className="px-8">
              Đóng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VitalDetailModal;
