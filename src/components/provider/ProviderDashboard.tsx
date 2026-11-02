import type { ReactNode } from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UI_ACTION, UI_BADGE, translatePatientStatus } from "@/config/ui-labels";
import { greetingNow } from "@/lib/greeting";
import { useProviderDashboardData, useProviderDashboardRecentPatients } from "@/hooks/useProviderDashboardData";
import { formatWeekdayDate } from "@/lib/provider-dashboard-utils";
import { ADMIN_STATUS_COLOR, type AdminAppointmentStatus } from "@/types/admin-appointment";

type ProviderDashboardProps = {
  /** @deprecated dùng Link nội bộ */
  onOpenPatients?: () => void;
};

type StatCard = {
  label: string;
  value: string;
  sub: string;
  badge: string;
  badgeClass: string;
  href?: string;
  loading: boolean;
};

const MOCK_LABS_STAT = {
  label: "Kết quả xét nghiệm",
  value: "3",
  sub: "chờ duyệt",
  badge: "Ưu tiên",
  badgeClass: "bg-warning/10 text-warning",
};

const MOCK_MESSAGES_STAT = {
  label: "Tin nhắn",
  value: "5",
  sub: "chưa đọc",
  badge: UI_BADGE.inbox,
  badgeClass: "bg-blue-50 text-blue-700",
};

function statusPill(status: string) {
  if (status === "Active" || status === "Stable") return "bg-emerald-100 text-emerald-700";
  if (status === "Review") return "bg-amber-100 text-amber-700";
  if (status === "Draft") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

function apptStatusClass(status: AdminAppointmentStatus): string {
  return ADMIN_STATUS_COLOR[status] ?? "bg-muted text-muted-foreground";
}

function primaryActionLabel(status: AdminAppointmentStatus): string {
  if (status === "CONFIRMED") return "Tiếp nhận";
  if (status === "CHECKED_IN" || status === "IN_PROGRESS") return "Khám";
  return "Xem phiếu";
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function SectionHeader({
  title,
  aside,
  linkTo,
  linkLabel,
  right,
}: {
  title: string;
  aside?: ReactNode;
  linkTo?: string;
  linkLabel?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary hover:underline"
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
      {right}
    </div>
  );
}

const ProviderDashboard = ({ onOpenPatients: _onOpenPatients }: ProviderDashboardProps) => {
  const now = new Date();
  const greeting = greetingNow(now);
  const { data, isLoading, isError, refetch, isFetching } = useProviderDashboardData(now);
  const {
    data: patientData,
    isLoading: patientsLoading,
    isError: patientsError,
    refetch: refetchPatients,
    isFetching: patientsFetching,
  } = useProviderDashboardRecentPatients();

  const monitoringStats = patientData?.monitoringStats ?? data?.monitoringStats;
  const recentPatients = patientData?.recentPatients ?? [];

  const stats: StatCard[] = [
    {
      label: "Lịch hôm nay",
      value: data ? String(data.todayStats.total) : "—",
      sub: data
        ? [`${data.todayStats.remaining} còn lại`, data.todayStats.nextTime].filter(Boolean).join(" · ")
        : "—",
      badge: "Hôm nay",
      badgeClass: "bg-primary/10 text-primary",
      href: "/provider-portal/appointments",
      loading: isLoading,
    },
    { ...MOCK_LABS_STAT, loading: false },
    { ...MOCK_MESSAGES_STAT, loading: false },
    {
      label: "Bệnh nhân đang theo dõi",
      value: monitoringStats ? String(monitoringStats.total) : "—",
      sub: monitoringStats
        ? monitoringStats.newThisWeek > 0
          ? `+${monitoringStats.newThisWeek} BN mới tuần này`
          : "không có BN mới tuần này"
        : "—",
      badge: UI_BADGE.active,
      badgeClass: "bg-success/10 text-success",
      href: "/provider-portal/patients",
      loading: patientsLoading,
    },
  ];

  const weeklyChart = data?.weeklyChart ?? [];
  const weeklyTotal = weeklyChart.reduce((sum, d) => sum + d.count, 0);
  const weeklyMax = Math.max(1, ...weeklyChart.map((d) => d.count));

  const summaryText = isLoading
    ? "Đang tải tổng quan hôm nay…"
    : `Hôm nay có ${data?.todayStats.total ?? 0} lịch khám và ${MOCK_LABS_STAT.value} kết quả xét nghiệm đang chờ duyệt.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {greeting}, {isLoading ? "…" : data?.doctorName ?? "Bác sĩ"}
          </h1>
          <p className="text-sm text-muted-foreground">{summaryText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isError || patientsError) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
                void refetchPatients();
              }}
              disabled={isFetching || patientsFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching || patientsFetching ? "animate-spin" : ""}`}
              />
              Thử lại
            </Button>
          )}
          <Link
            to="/provider-portal/appointments"
            className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Xem lịch hẹn
          </Link>
          <Link
            to="/provider-portal/patients"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {UI_ACTION.openPatients}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        {stats.map((card, i) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${card.badgeClass}`}
                >
                  {card.badge}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-semibold leading-none tabular-nums">
                  {card.loading ? "…" : card.value}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {card.loading ? "Đang tải…" : card.sub}
                </span>
              </div>
            </>
          );
          const borders = [
            i % 2 === 0 ? "border-r" : "",
            i < 2 ? "border-b lg:border-b-0" : "",
            i < stats.length - 1 ? "lg:border-r" : "lg:border-r-0",
          ].join(" ");
          const cellClass = `flex flex-col gap-1.5 px-4 py-3.5 text-left ${borders}`;
          return card.href ? (
            <Link key={card.label} to={card.href} className={`${cellClass} transition-colors hover:bg-primary/5`}>
              {content}
            </Link>
          ) : (
            <div key={card.label} className={cellClass}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <SectionHeader
            title="Lịch khám hôm nay"
            aside={<span className="text-xs capitalize text-muted-foreground">{formatWeekdayDate(now)}</span>}
            linkTo="/provider-portal/appointments"
            linkLabel="Tất cả lịch hẹn"
          />
          {isLoading ? (
            <SectionLoading />
          ) : (
            <>
              {data?.todaySchedule.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Không có lịch hôm nay.</p>
              ) : (
                <ul>
                  {data?.todaySchedule.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b bg-primary/5 px-4 py-3 shadow-[inset_3px_0_0_hsl(var(--primary))] sm:grid-cols-[64px_minmax(0,1fr)_auto_auto]"
                    >
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-primary">
                        {item.time}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.patient}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[item.type, item.mode, item.phone].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span
                        className={`hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold sm:inline-block ${apptStatusClass(item.status)}`}
                      >
                        {item.statusLabel}
                      </span>
                      <Link
                        to={item.href}
                        className="inline-flex h-[30px] items-center whitespace-nowrap rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        {primaryActionLabel(item.status)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Sắp tới
              </div>
              {data?.upcomingSchedule.length === 0 ? (
                <p className="border-t px-4 py-4 text-xs text-muted-foreground">Chưa có lịch hẹn sắp tới.</p>
              ) : (
                <ul>
                  {data?.upcomingSchedule.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-2 sm:grid-cols-[64px_120px_minmax(0,1fr)_auto]"
                    >
                      <span className="font-mono font-medium tabular-nums">{item.time}</span>
                      <span className="hidden whitespace-nowrap text-muted-foreground sm:inline">
                        {item.dateLabel}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.patient}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{item.dateLabel}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${apptStatusClass(item.status)}`}
                      >
                        {item.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
          <SectionHeader
            title="Tư vấn tuần này"
            right={
              <span className="text-xs text-muted-foreground">
                <b className="font-semibold text-foreground">{isLoading ? "…" : weeklyTotal}</b> lượt
              </span>
            }
          />
          {isLoading ? (
            <SectionLoading />
          ) : (
            <div
              role="img"
              aria-label={`Tư vấn tuần này: ${weeklyChart.map((d) => `${d.day} ${d.count}`).join(", ")}`}
              className="grid min-h-[160px] flex-1 grid-cols-7 items-end gap-2.5 bg-[linear-gradient(hsl(var(--border))_1px,transparent_1px)] bg-[length:100%_25%] px-4 pb-2.5 pt-4 [background-origin:content-box]"
            >
              {weeklyChart.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1.5">
                  {d.count > 0 && <span className="text-[11px] font-semibold tabular-nums">{d.count}</span>}
                  <div
                    className={`w-full ${d.count > 0 ? "rounded-t bg-primary" : "h-[3px] rounded-sm bg-muted"}`}
                    style={d.count > 0 ? { height: `${Math.max(12, (d.count / weeklyMax) * 100)}px` } : undefined}
                  />
                  <span
                    className={`text-[11px] ${d.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                  >
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-3">
          <SectionHeader title="Bệnh nhân gần đây" linkTo="/provider-portal/patient-records" linkLabel="Xem tất cả" />
          {patientsLoading ? (
            <SectionLoading />
          ) : patientsError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Không tải được danh sách bệnh nhân.</p>
              <Button type="button" variant="link" size="sm" className="mt-2" onClick={() => void refetchPatients()}>
                Thử lại
              </Button>
            </div>
          ) : recentPatients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có bệnh nhân.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Bệnh nhân</th>
                    <th className="px-2 py-2 font-semibold">Tuổi</th>
                    <th className="px-2 py-2 font-semibold">Lần khám</th>
                    <th className="px-4 py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatients.map((row) => (
                    <tr key={row.id} className="h-10 border-t">
                      <td className="max-w-[220px] truncate px-4 font-medium">{row.name}</td>
                      <td className="px-2 text-muted-foreground">{row.age ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 text-muted-foreground">{row.last}</td>
                      <td className="px-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${statusPill(row.status)}`}
                        >
                          {translatePatientStatus(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <SectionHeader title="Việc lâm sàng" linkTo="/provider-portal/tasks" linkLabel="Xem tất cả" />
          {isLoading ? (
            <SectionLoading />
          ) : data?.clinicalTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
              <p className="font-semibold text-foreground/80">Chưa có việc lâm sàng</p>
              <p className="text-xs text-muted-foreground">
                Việc cần làm sẽ xuất hiện khi có kết quả cần duyệt hoặc phiếu cần ký.
              </p>
            </div>
          ) : (
            <ul className="space-y-4 p-4">
              {data?.clinicalTasks.map((task) => (
                <li key={task.id}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{task.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{task.due}</span>
                  </div>
                  <Progress value={task.done} className="h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProviderDashboard;
