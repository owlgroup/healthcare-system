import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  format, parseISO, isValid, differenceInYears,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from "date-fns";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Loader2,
  Search, MoreHorizontal, CheckCircle2, CalendarClock, XCircle, Trash2,
  HeartPulse, Mail, FileText,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { searchAdminAppointments } from "@/lib/admin-appointment-api";
import { appointmentHasPreConsult } from "@/lib/appointment-readiness";
import { sendPreConsultReminder } from "@/lib/doctor-appointment-api";
import { fetchSpecialties } from "@/lib/appointment-api";
import { fetchDoctors } from "@/lib/master-data-api";

import { UI_CHECK_IN, UI_CHECKED_IN, DOCTOR_PREFIX } from "@/config/ui-labels";
import {
  ADMIN_STATUS_LABEL, ADMIN_STATUS_COLOR, ADMIN_STATUS_DOT, WALK_IN_LABEL,
  type AdminAppointment, type AdminAppointmentStatus, type AdminAppointmentsListParams,
} from "@/types/admin-appointment";

import WalkInDialog from "./appointments/WalkInDialog";
import BulkCancelDialog from "./appointments/BulkCancelDialog";
import AppointmentDetailSheet from "./appointments/AppointmentDetailSheet";
import CancelDialog from "./appointments/CancelDialog";
import RescheduleDialog from "./appointments/RescheduleDialog";
import VitalSignsSheet from "./appointments/VitalSignsSheet";

const APPOINTMENT_LIST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ADMIN_APPOINTMENTS_QUERY_KEY = ["admin-appointments"] as const;

type ViewMode = "all" | "today" | "week" | "month";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "all",   label: "Tất cả" },
  { value: "today", label: "Hôm nay" },
  { value: "week",  label: "Tuần này" },
  { value: "month", label: "Tháng này" },
];

const ALL_STATUSES: { value: AdminAppointmentStatus | "__all__"; label: string; dot: string }[] = [
  { value: "__all__",    label: "Tất cả trạng thái", dot: "bg-muted-foreground/40" },
  { value: "CONFIRMED",  label: "Chờ khám",          dot: ADMIN_STATUS_DOT.CONFIRMED },
  { value: "CHECKED_IN", label: UI_CHECKED_IN,       dot: ADMIN_STATUS_DOT.CHECKED_IN },
  { value: "IN_PROGRESS",label: "Đang khám",         dot: ADMIN_STATUS_DOT.IN_PROGRESS },
  { value: "COMPLETED",  label: "Hoàn thành",        dot: ADMIN_STATUS_DOT.COMPLETED },
  { value: "CANCELLED",  label: "Đã hủy",            dot: ADMIN_STATUS_DOT.CANCELLED },
  { value: "NO_SHOW",    label: "Không đến",         dot: ADMIN_STATUS_DOT.NO_SHOW },
];

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Cột bảng: chọn · ngày giờ · bệnh nhân · chuyên khoa · loại · bác sĩ · trạng thái · thao tác */
const ROW_GRID =
  "grid grid-cols-[2rem_9.5rem_minmax(14rem,1fr)_8rem_7rem_9rem_8.5rem_10rem] items-center gap-3";

function avatarInitial(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[parts.length - 1]?.charAt(0) ?? "?").toUpperCase();
}

function safeParse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

function rangeFor(mode: ViewMode, ref: Date): Pick<AdminAppointmentsListParams, "dateFrom" | "dateTo"> {
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  switch (mode) {
    case "today": return { dateFrom: f(ref), dateTo: f(ref) };
    case "week":  return {
      dateFrom: f(startOfWeek(ref, { weekStartsOn: 1 })),
      dateTo:   f(endOfWeek(ref,   { weekStartsOn: 1 })),
    };
    case "month": return { dateFrom: f(startOfMonth(ref)), dateTo: f(endOfMonth(ref)) };
    default:      return { dateFrom: undefined, dateTo: undefined };
  }
}

export default function AdminAppointmentsContent() {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [doctorFilter, setDoctorFilter] = useState<string>("__all__");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [listPage, setListPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailAppt, setDetailAppt] = useState<AdminAppointment | null>(null);
  const [cancelAppt, setCancelAppt] = useState<AdminAppointment | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<AdminAppointment | null>(null);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [vitalSignsAppt, setVitalSignsAppt] = useState<AdminAppointment | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setListPage(1);
    setSelectedIds(new Set());
  }, [viewMode, todayStr, specialtyFilter, statusFilter, doctorFilter, debouncedSearch]);

  /** Bộ lọc dùng chung (không gồm khoảng ngày / phân trang). */
  const baseFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter === "__all__" ? undefined : statusFilter,
      specialtyId: specialtyFilter === "__all__" ? undefined : specialtyFilter,
      doctorId: doctorFilter === "__all__" ? undefined : doctorFilter,
    }),
    [debouncedSearch, statusFilter, specialtyFilter, doctorFilter],
  );

  const listQueryParams = useMemo<AdminAppointmentsListParams>(
    () => ({
      ...baseFilters,
      ...rangeFor(viewMode, parseISO(todayStr)),
      page: listPage,
      limit: APPOINTMENT_LIST_PAGE_SIZE,
    }),
    [baseFilters, viewMode, todayStr, listPage],
  );

  const { data: appointmentListData, isFetching, refetch } = useQuery({
    queryKey: [...ADMIN_APPOINTMENTS_QUERY_KEY, listQueryParams],
    queryFn: async () => {
      const { rows, total, error } = await searchAdminAppointments(listQueryParams);
      if (error) throw error;
      return { rows, total };
    },
    placeholderData: (previous) => previous,
  });

  /** Số lượng theo từng khoảng thời gian — hiển thị trên tab phân đoạn. */
  const { data: rangeCounts, refetch: refetchCounts } = useQuery({
    queryKey: [...ADMIN_APPOINTMENTS_QUERY_KEY, "range-counts", baseFilters, todayStr],
    queryFn: async () => {
      const ref = parseISO(todayStr);
      const entries = await Promise.all(
        VIEW_MODES.map(async ({ value }) => {
          const { total, error } = await searchAdminAppointments({
            ...baseFilters, ...rangeFor(value, ref), page: 1, limit: 1,
          });
          return [value, error ? null : total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<ViewMode, number | null>;
    },
    placeholderData: (previous) => previous,
  });

  const appointments = appointmentListData?.rows ?? [];
  const appointmentTotal = appointmentListData?.total ?? 0;
  const appointmentTotalPages = Math.max(
    1,
    Math.ceil(appointmentTotal / APPOINTMENT_LIST_PAGE_SIZE),
  );
  const appointmentFrom =
    appointmentTotal === 0 ? 0 : (listPage - 1) * APPOINTMENT_LIST_PAGE_SIZE + 1;
  const appointmentTo =
    appointmentTotal === 0
      ? 0
      : Math.min(listPage * APPOINTMENT_LIST_PAGE_SIZE, appointmentTotal);

  const { data: specialties = [] } = useQuery({
    queryKey: ["specialties"],
    queryFn:  fetchSpecialties,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn:  fetchDoctors,
  });

  const refresh = () => {
    setSelectedIds(new Set());
    void refetch();
    void refetchCounts();
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const selectableIds = appointments
    .filter((a) => !["CANCELLED", "COMPLETED"].includes(a.status))
    .map((a) => a.id);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds((prev) => prev.size === selectableIds.length ? new Set() : new Set(selectableIds));
  };

  async function handlePreConsultReminder(appt: AdminAppointment) {
    if (appointmentHasPreConsult(appt)) {
      toast.info("Đã có khai báo trước khám (bệnh nhân hoặc bác sĩ).");
      return;
    }
    setRemindingId(appt.id);
    try {
      const { emailSent, email, emailError } = await sendPreConsultReminder(appt.id);
      if (emailSent) {
        toast.success(`Đã gửi email nhắc nhở${email ? ` tới ${email}` : ""}.`);
      } else {
        toast.error(emailError ?? "Không gửi được email nhắc nhở.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gửi được email nhắc nhở.");
    } finally {
      setRemindingId(null);
    }
  }

  const statusCurrent = ALL_STATUSES.find((s) => s.value === statusFilter) ?? ALL_STATUSES[0];

  return (
    <div className="space-y-3">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="tablist"
          aria-label="Khoảng thời gian"
          className="flex gap-0.5 rounded-lg bg-muted p-[3px]"
        >
          {VIEW_MODES.map((m) => {
            const active = viewMode === m.value;
            const count = rangeCounts?.[m.value];
            return (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(m.value)}
                className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
                {count != null && (
                  <span className="text-[11px] font-medium text-muted-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full min-w-[12rem] max-w-[22rem] flex-1 sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Tìm bệnh nhân"
            className="h-[34px] bg-card pl-9"
            placeholder="Tìm bệnh nhân (tên, SĐT, CCCD)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            aria-label="Lọc theo trạng thái"
            className={`h-[34px] w-[13rem] bg-card ${statusFilter !== "__all__" ? "border-primary" : ""}`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusCurrent.dot}`} />
              <SelectValue placeholder="Tất cả trạng thái" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger aria-label="Lọc theo chuyên khoa" className="h-[34px] w-[11rem] bg-card">
            <SelectValue placeholder="Tất cả chuyên khoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tất cả chuyên khoa</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger aria-label="Lọc theo bác sĩ" className="h-[34px] w-[11rem] bg-card">
            <SelectValue placeholder="Tất cả bác sĩ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tất cả bác sĩ</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.user_id} value={d.user_id}>{d.full_name ?? d.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {appointmentTotal} lịch hẹn
        </span>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer bg-card"
          onClick={refresh}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
        <Button size="sm" className="h-8 cursor-pointer" onClick={() => setWalkInOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {WALK_IN_LABEL}
        </Button>
      </div>

      {/* ── Bulk actions bar ─────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} lịch đã chọn</span>
          <Button size="sm" variant="destructive" onClick={() => setBulkCancelOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Hủy tất cả
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Bỏ chọn
          </Button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[10px] border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[68rem]">
            <div className={`${ROW_GRID} border-b bg-muted/40 px-4 py-2.5`}>
              <Checkbox
                aria-label="Chọn tất cả"
                checked={selectableIds.length > 0 && selectedIds.size === selectableIds.length}
                onCheckedChange={selectAll}
                disabled={selectableIds.length === 0}
              />
              {["Ngày · Giờ", "Bệnh nhân", "Chuyên khoa", "Loại", "Bác sĩ", "Trạng thái"].map((h) => (
                <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </span>
              ))}
              <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Thao tác
              </span>
            </div>

            {isFetching && appointments.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Đang tải…</span>
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Không có lịch hẹn phù hợp bộ lọc.</p>
                <Button className="mt-4" size="sm" onClick={() => setWalkInOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {WALK_IN_LABEL}
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    todayStr={todayStr}
                    selected={selectedIds.has(appt.id)}
                    onToggle={() => toggleSelect(appt.id)}
                    onOpen={() =>
                      appt.status === "COMPLETED" || appt.status === "CANCELLED" || appt.status === "NO_SHOW"
                        ? setDetailAppt(appt)
                        : setVitalSignsAppt(appt)
                    }
                    onCheckin={() => setVitalSignsAppt(appt)}
                    onViewDetail={() => setDetailAppt(appt)}
                    onCancel={() => setCancelAppt(appt)}
                    onReschedule={() => setRescheduleAppt(appt)}
                    onVitalSigns={() => setVitalSignsAppt(appt)}
                    onPreConsultReminder={() => void handlePreConsultReminder(appt)}
                    reminding={remindingId === appt.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {appointmentTotal > 0 ? (
          <div className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Hiển thị{" "}
              <span className="font-semibold text-foreground">
                {appointmentFrom}–{appointmentTo}
              </span>{" "}
              / {appointmentTotal} lịch hẹn
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-card"
                aria-label="Trang trước"
                disabled={listPage <= 1 || isFetching}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[56px] text-center text-xs font-medium text-muted-foreground">
                {listPage}/{appointmentTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-card"
                aria-label="Trang sau"
                disabled={listPage >= appointmentTotalPages || isFetching}
                onClick={() => setListPage((p) => Math.min(appointmentTotalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Walk-in dialog ───────────────────────────────────────────────────── */}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onSuccess={() => { setWalkInOpen(false); refresh(); }}
      />

      {/* ── Bulk cancel ─────────────────────────────────────────────────────── */}
      <BulkCancelDialog
        appointmentIds={Array.from(selectedIds)}
        open={bulkCancelOpen}
        onClose={() => setBulkCancelOpen(false)}
        onSuccess={() => { setBulkCancelOpen(false); refresh(); }}
      />

      {/* ── Detail sheet ────────────────────────────────────────────────────── */}
      <AppointmentDetailSheet
        appointment={detailAppt}
        open={!!detailAppt}
        onClose={() => setDetailAppt(null)}
        onRefresh={refresh}
      />

      {/* ── Quick cancel from row ────────────────────────────────────────────── */}
      {cancelAppt && (
        <CancelDialog
          appointment={cancelAppt}
          open={!!cancelAppt}
          onClose={() => setCancelAppt(null)}
          onSuccess={() => { setCancelAppt(null); refresh(); }}
        />
      )}

      {/* ── Quick reschedule from row ────────────────────────────────────────── */}
      {rescheduleAppt && (
        <RescheduleDialog
          appointment={rescheduleAppt}
          open={!!rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSuccess={() => { setRescheduleAppt(null); refresh(); }}
        />
      )}

      {/* ── Nhập sinh hiệu sheet ─────────────────────────────────────────────── */}
      <VitalSignsSheet
        appointment={vitalSignsAppt}
        onClose={() => setVitalSignsAppt(null)}
      />
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

interface RowProps {
  appt: AdminAppointment;
  todayStr: string;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onCheckin: () => void;
  onViewDetail: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onVitalSigns: () => void;
  onPreConsultReminder: () => void;
  reminding: boolean;
}

function Chip({ className, children, title }: { className: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`whitespace-nowrap rounded-lg px-1.5 text-[10.5px] font-semibold leading-[18px] ${className}`}
    >
      {children}
    </span>
  );
}

function AppointmentRow({
  appt, todayStr, selected, onToggle, onOpen, onCheckin, onViewDetail, onCancel, onReschedule,
  onVitalSigns, onPreConsultReminder, reminding,
}: RowProps) {
  const initials = avatarInitial(appt.patient_name);

  const apptDate = safeParse(appt.slot_date) ?? safeParse(appt.created_at);
  const apptDateStr = apptDate ? format(apptDate, "yyyy-MM-dd") : null;
  const isToday = apptDateStr === todayStr;
  const timeText = appt.start_time?.slice(0, 5) ?? null;
  const dob = safeParse(appt.patient_dob);
  const age = dob ? differenceInYears(new Date(), dob) : null;
  const subtitle = [appt.patient_phone, age != null ? `${age} tuổi` : null].filter(Boolean).join(" · ");

  const isSelectable = !["CANCELLED", "COMPLETED"].includes(appt.status);
  const canCheckin     = appt.status === "CONFIRMED";
  const canCancel      = !["CANCELLED", "COMPLETED"].includes(appt.status);
  const canReschedule  = ["CONFIRMED", "CHECKED_IN"].includes(appt.status) && !appt.walk_in;
  const canVitalSigns  = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(appt.status);
  const canRemindPreConsult =
    !appointmentHasPreConsult(appt) &&
    ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(appt.status);
  const isDone = appt.status === "COMPLETED";

  return (
    <div
      className={`${ROW_GRID} relative min-h-[52px] cursor-pointer px-4 py-2 transition-colors duration-150 hover:bg-muted/30 ${
        selected ? "bg-primary/5" : isToday ? "bg-primary/[0.03]" : ""
      }`}
      style={isToday ? { boxShadow: "inset 3px 0 0 hsl(var(--primary))" } : undefined}
      onClick={onOpen}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`Chọn lịch hẹn ${appt.patient_name ?? ""}`}
          checked={selected}
          onCheckedChange={onToggle}
          disabled={!isSelectable}
        />
      </div>

      {/* Date · time */}
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span
          className={`font-mono text-[13.5px] font-semibold ${
            timeText ? "text-foreground" : "text-orange-600"
          }`}
        >
          {timeText ?? "--:--"}
        </span>
        {apptDate && (
          <span className="text-xs text-muted-foreground">
            {WEEKDAY_SHORT[apptDate.getDay()]} {format(apptDate, "dd/MM/yyyy")}
          </span>
        )}
      </div>

      {/* Patient */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
          {initials}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{appt.patient_name || "—"}</span>
            {appt.pre_consult_drug_allergy && (
              <Chip className="bg-primary/10 text-primary" title="Dị ứng thuốc (khai báo trước khám)">
                Dị ứng thuốc
              </Chip>
            )}
            {appt.pre_consult_severe_pain && (
              <Chip className="bg-orange-50 text-orange-700" title="Đau dữ dội (khai báo trước khám)">
                Đau dữ dội
              </Chip>
            )}
            {appointmentHasPreConsult(appt) && (
              <Chip className="bg-emerald-50 text-emerald-700" title="Đã khai báo y tế trước khám">
                Có khai báo
              </Chip>
            )}
          </div>
          {subtitle && (
            <span className="block truncate text-[11.5px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Specialty */}
      <span className="truncate text-sm text-foreground/80">{appt.specialty_name ?? "—"}</span>

      {/* Type */}
      <span className={`truncate text-sm ${appt.walk_in ? "text-orange-600" : "text-foreground/80"}`}>
        {appt.walk_in ? "Không hẹn" : "Có hẹn"}
      </span>

      {/* Doctor */}
      <span className="truncate text-sm text-foreground/80">
        {appt.doctor_name ? `${DOCTOR_PREFIX} ${appt.doctor_name.split(" ").pop()}` : "—"}
      </span>

      {/* Status */}
      <span
        className={`inline-flex items-center gap-1.5 justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${ADMIN_STATUS_COLOR[appt.status]}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ADMIN_STATUS_DOT[appt.status]}`} />
        {ADMIN_STATUS_LABEL[appt.status]}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {canCheckin && (
          <Button size="sm" className="h-[30px] cursor-pointer px-3 text-[12.5px]" onClick={onCheckin}>
            {UI_CHECK_IN}
          </Button>
        )}
        {(appt.status === "CHECKED_IN" || appt.status === "IN_PROGRESS") && (
          <Button
            size="sm"
            variant="outline"
            className="h-[30px] cursor-pointer px-3 text-[12.5px]"
            onClick={onVitalSigns}
          >
            Sinh hiệu
          </Button>
        )}
        {isDone && (
          <Button
            size="sm"
            variant="outline"
            className="h-[30px] cursor-pointer px-3 text-[12.5px]"
            onClick={onViewDetail}
          >
            Xem phiếu
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Thao tác khác"
              className="h-[30px] w-[30px] cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onViewDetail}>
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              Xem chi tiết
            </DropdownMenuItem>
            {canCheckin && (
              <DropdownMenuItem onClick={onCheckin}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                {UI_CHECK_IN}
              </DropdownMenuItem>
            )}
            {canVitalSigns && (
              <DropdownMenuItem onClick={onVitalSigns}>
                <HeartPulse className="mr-2 h-4 w-4 text-teal-600" />
                Nhập sinh hiệu
              </DropdownMenuItem>
            )}
            {canRemindPreConsult && (
              <DropdownMenuItem disabled={reminding} onClick={onPreConsultReminder}>
                {reminding
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Mail className="mr-2 h-4 w-4 text-pink-600" />}
                Nhắc nhở khai báo
              </DropdownMenuItem>
            )}
            {(canReschedule || canCancel) && <DropdownMenuSeparator />}
            {canReschedule && (
              <DropdownMenuItem onClick={onReschedule}>
                <CalendarClock className="mr-2 h-4 w-4 text-amber-500" />
                Đổi lịch
              </DropdownMenuItem>
            )}
            {canCancel && (
              <DropdownMenuItem
                onClick={onCancel}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Hủy lịch
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
