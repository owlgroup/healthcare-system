import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSpecialties } from "@/lib/appointment-api";
import {
  resolveAiAccuracyDateRange,
  SOAP_SECTION_LABELS,
  toDoctorChartRows,
  toSoapChartRows,
  type AiAccuracyDatePreset,
  type SoapChartRow,
} from "@/lib/ai-accuracy-stats";
import { getAiAccuracyStats, type AiAccuracyStatsFilters } from "@/lib/emr-api";
import { cn } from "@/lib/utils";

const AI_KEEP_COLOR = "#C41740";
const AI_EDIT_COLOR = "#F1B6C4";

const TIME_PRESETS: { value: AiAccuracyDatePreset; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
];

export default function AdminAiAccuracyPage() {
  const [preset, setPreset] = useState<AiAccuracyDatePreset>("all");
  const [specialtyId, setSpecialtyId] = useState("__all__");

  const filters = useMemo<AiAccuracyStatsFilters>(() => {
    const range = resolveAiAccuracyDateRange(preset, null, null);
    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      specialtyId: specialtyId === "__all__" ? null : specialtyId,
    };
  }, [preset, specialtyId]);

  const { data: specialties = [] } = useQuery({
    queryKey: ["ai-accuracy-specialties"],
    queryFn: fetchSpecialties,
  });

  const {
    data: stats,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["ai-accuracy-stats", filters],
    queryFn: () => getAiAccuracyStats(filters),
  });

  const soapRows = useMemo(() => toSoapChartRows(stats?.by_soap), [stats?.by_soap]);
  const doctorRows = useMemo(() => toDoctorChartRows(stats?.by_doctor), [stats?.by_doctor]);
  const hasData = (stats?.total_signed_with_ai ?? 0) > 0;
  const hasActiveFilters = Boolean(filters.dateFrom || filters.dateTo || filters.specialtyId);

  function handleReset() {
    setPreset("all");
    setSpecialtyId("__all__");
  }

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !stats) {
    return <p className="text-destructive text-sm">{(error as Error).message}</p>;
  }

  const retention = stats?.avg_ai_retention_pct ?? 0;
  const editRate = stats?.edit_rate_pct ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Báo cáo <span className="text-muted-foreground/60 mx-1">›</span> AI
        </p>
        <h1 className="text-2xl font-bold text-foreground mt-1">Báo cáo độ chính xác AI</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Tỷ lệ nội dung SOAP do AI sinh ra được bác sĩ giữ nguyên hoặc chỉnh sửa trước khi ký duyệt.
        </p>
      </header>

      <Card className="border-border/40 shadow-sm">
        <CardContent className="pt-5 pb-5 space-y-5">
          <FilterRow label="Thời gian">
            {TIME_PRESETS.map((item) => (
              <FilterPill
                key={item.value}
                active={preset === item.value}
                onClick={() => setPreset(item.value)}
              >
                {item.label}
              </FilterPill>
            ))}
          </FilterRow>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <FilterRow label="Chuyên khoa" className="flex-1">
              <FilterPill
                active={specialtyId === "__all__"}
                onClick={() => setSpecialtyId("__all__")}
              >
                Tất cả
              </FilterPill>
              {specialties.map((s) => (
                <FilterPill
                  key={s.id}
                  active={specialtyId === s.id}
                  onClick={() => setSpecialtyId(s.id)}
                >
                  {s.name}
                </FilterPill>
              ))}
            </FilterRow>
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasActiveFilters && preset === "all" && specialtyId === "__all__"}
              className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Xóa lọc
            </button>
          </div>
          {isFetching && stats && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Hồ sơ có AI baseline"
          value={String(stats?.total_signed_with_ai ?? 0)}
          subtitle="Hồ sơ đã ký có dữ liệu AI"
        />
        <MetricCard
          title="Bác sĩ đã chỉnh sửa"
          value={String(stats?.doctor_edited_count ?? 0)}
          subtitle="Có thay đổi so với AI"
        />
        <MetricCard
          title="Tỷ lệ giữ nguyên AI"
          value={`${retention}%`}
          subtitle="Nội dung AI được giữ"
          valueClassName="text-emerald-600"
        />
        <MetricCard
          title="Tỷ lệ chỉnh sửa"
          value={`${editRate}%`}
          subtitle="Bác sĩ thay đổi nội dung"
          valueClassName="text-primary"
        />
      </div>

      {hasData ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Theo thành phần SOAP</CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Tỷ lệ giữ nguyên so với chỉnh sửa trên từng mục S/O/A/P.
              </p>
            </CardHeader>
            <CardContent>
              <SoapComponentChart rows={soapRows} />
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Hiệu suất theo bác sĩ</CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Tỷ lệ giữ nguyên nội dung AI trên hồ sơ đã ký.
              </p>
            </CardHeader>
            <CardContent>
              {doctorRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu bác sĩ.</p>
              ) : (
                <ul className="space-y-5">
                  {doctorRows.map((row) => (
                    <li key={row.doctorId} className="space-y-2">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <p className="font-medium text-foreground leading-snug min-w-0">
                          {row.doctorName}
                        </p>
                        <div className="text-right shrink-0 text-xs text-muted-foreground">
                          <p>
                            {row.total} hồ sơ · sửa {row.editedCount}
                          </p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {row.retentionPct}%
                          </p>
                        </div>
                      </div>
                      <div
                        className="h-2.5 w-full rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-valuenow={row.retentionPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${row.doctorName}: ${row.retentionPct}% giữ nguyên AI`}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.retentionPct))}%`,
                            backgroundColor: AI_KEEP_COLOR,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-border/40">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu trong bộ lọc đã chọn
          </CardContent>
        </Card>
      )}

      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Giải thích chỉ số</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          <p>
            Hệ thống so sánh bản SOAP do AI đề xuất với bản cuối cùng bác sĩ ký duyệt và tính tỷ lệ
            chênh lệch văn bản. Chỉ tài khoản Quản trị viên được truy cập màn hình này.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer border",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-foreground border-border/60 hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  valueClassName,
}: {
  title: string;
  value: string;
  subtitle: string;
  valueClassName?: string;
}) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardContent className="pt-5 pb-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={cn("text-3xl font-bold mt-2 tabular-nums", valueClassName)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function SoapComponentChart({ rows }: { rows: SoapChartRow[] }) {
  const maxBarHeight = 160;

  return (
    <div>
      <div className="flex items-end justify-between gap-2 sm:gap-4 px-1">
        {rows.map((row) => (
          <div key={row.section} className="flex-1 flex flex-col items-center min-w-0">
            <div className="flex items-end justify-center gap-1.5 h-[200px] w-full">
              <SoapBar
                pct={row.retentionPct}
                color={AI_KEEP_COLOR}
                maxHeight={maxBarHeight}
              />
              <SoapBar
                pct={row.editPct}
                color={AI_EDIT_COLOR}
                maxHeight={maxBarHeight}
              />
            </div>
            <div className="mt-3 text-center">
              <p className="text-lg font-bold text-foreground leading-none">{row.section}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                {SOAP_SECTION_LABELS[row.section]}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 border-t border-border/40 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AI_KEEP_COLOR }} />
          Giữ nguyên AI
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AI_EDIT_COLOR }} />
          Chỉnh sửa
        </span>
      </div>
    </div>
  );
}

function SoapBar({
  pct,
  color,
  maxHeight,
}: {
  pct: number;
  color: string;
  maxHeight: number;
}) {
  const height = Math.max(4, (pct / 100) * maxHeight);
  const display = `${pct}%`;

  return (
    <div className="flex flex-col items-center justify-end flex-1 max-w-[36px] h-full">
      <span className="text-[10px] font-semibold text-foreground mb-1 tabular-nums">{display}</span>
      <div
        className="w-full rounded-t-md min-h-[4px] transition-all"
        style={{ height, backgroundColor: color }}
        title={display}
      />
    </div>
  );
}
