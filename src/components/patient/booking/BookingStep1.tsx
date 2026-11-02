import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Apple,
  ArrowRight,
  Brain,
  CheckCircle2,
  FlaskConical,
  Heart,
  HeartPulse,
  Loader2,
  Search,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { fetchSpecialties } from '@/lib/appointment-api';
import type { Specialty } from '@/types/appointment';

const ICON_MAP: Record<string, React.ElementType> = {
  'heart-pulse': HeartPulse,
  'stethoscope': Stethoscope,
  'shield': ShieldCheck,
  'brain': Brain,
  'flask': FlaskConical,
  'heart': Heart,
  'apple': Apple,
  'alert': AlertTriangle,
};

const ICON_STYLES: Record<string, { bg: string; color: string }> = {
  'prep': { bg: 'bg-teal-50', color: 'text-teal-600' },
  'sti': { bg: 'bg-blue-50', color: 'text-blue-600' },
  'pep': { bg: 'bg-orange-50', color: 'text-orange-700' },
  'general': { bg: 'bg-slate-100', color: 'text-slate-600' },
  'nutrition': { bg: 'bg-emerald-50', color: 'text-emerald-600' },
  'mental': { bg: 'bg-purple-50', color: 'text-purple-600' },
  'default': { bg: 'bg-slate-100', color: 'text-slate-600' },
};

type Props = {
  onSelect: (specialty: Specialty) => void;
};

export default function BookingStep1({ onSelect }: Props) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Specialty | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSpecialties()
      .then(setSpecialties)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredSpecialties = specialties.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  function handleSelect(specialty: Specialty) {
    setSelected(specialty);
  }

  function handleNext() {
    if (selected) {
      onSelect(selected);
    }
  }

  function getIconStyle(name: string) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('prep') || lowerName.includes('pep')) return ICON_STYLES.prep;
    if (lowerName.includes('sti') || lowerName.includes('sàng lọc')) return ICON_STYLES.sti;
    if (lowerName.includes('khẩn') || lowerName.includes('cấp')) return ICON_STYLES.pep;
    if (lowerName.includes('tổng quát')) return ICON_STYLES.general;
    if (lowerName.includes('dinh dưỡng')) return ICON_STYLES.nutrition;
    if (lowerName.includes('tâm') || lowerName.includes('thần')) return ICON_STYLES.mental;
    return ICON_STYLES.default;
  }

  function getIcon(specialty: Specialty) {
    const lowerName = specialty.name.toLowerCase();
    if (lowerName.includes('prep') || lowerName.includes('pep')) return ShieldCheck;
    if (lowerName.includes('sti') || lowerName.includes('sàng lọc')) return FlaskConical;
    if (lowerName.includes('khẩn') || lowerName.includes('cấp')) return AlertTriangle;
    if (lowerName.includes('tổng quát')) return HeartPulse;
    if (lowerName.includes('dinh dưỡng')) return Apple;
    if (lowerName.includes('tâm') || lowerName.includes('thần')) return Brain;
    return ICON_MAP[specialty.icon ?? ''] ?? Stethoscope;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[14px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Không thể tải danh sách chuyên khoa. {error}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[18px] p-6 shadow-sm">
      <h2 className="text-[22px] font-bold text-slate-800 tracking-[-0.3px] mb-1">
        Bạn muốn khám gì hôm nay?
      </h2>
      <p className="text-slate-500 text-[14.5px] mb-5">
        Chọn nhu cầu phù hợp — hệ thống sẽ gợi ý bác sĩ và lịch khám thích hợp nhất cho bạn.
      </p>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm chuyên khoa, bác sĩ hoặc triệu chứng..."
          className="w-full pl-12 pr-4 py-2.5 text-[15px] border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
        />
      </div>

      {/* Section label */}
      <div className="text-[12px] font-bold text-slate-500 uppercase tracking-[0.5px] mb-3">
        Dịch vụ phổ biến tại RCARE
      </div>

      {/* Specialty Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {filteredSpecialties.map((s) => {
          const isSelected = selected?.id === s.id;
          const Icon = getIcon(s);
          const style = getIconStyle(s.name);

          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className={`relative flex items-center gap-3 p-4 rounded-[12px] border-2 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-teal-600 bg-teal-50 shadow-[0_0_0_3px_rgba(13,148,136,0.15)]'
                  : 'border-slate-200 bg-white hover:border-teal-600 hover:bg-teal-50 hover:-translate-y-px hover:shadow-sm'
              }`}
            >
              {/* Icon */}
              <div
                className={`w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 ${style.bg}`}
              >
                <Icon className={`h-5 w-5 ${style.color}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-slate-800 mb-0.5">
                  {s.name}
                </div>
                {s.description && (
                  <div className="text-[13px] text-slate-500 line-clamp-1">
                    {s.description}
                  </div>
                )}
              </div>

              {/* Check icon */}
              {isSelected && (
                <CheckCircle2 className="absolute top-2.5 right-2.5 h-[18px] w-[18px] text-teal-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <div className="flex justify-end mt-5">
        <button
          onClick={handleNext}
          disabled={!selected}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full text-[16px] font-semibold transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0 min-h-[48px] cursor-pointer"
        >
          Tiếp theo
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
