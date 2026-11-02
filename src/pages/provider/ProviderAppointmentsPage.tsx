import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays, differenceInYears, endOfMonth, endOfWeek,
  format, isValid, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarCheck, CalendarClock, CalendarX, ChevronLeft, ChevronRight,
  HeartPulse, Loader2, Mail, MoreHorizontal, Plus, Search, Stethoscope,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchDoctorSpecialtyId,
  searchDoctorAppointments,
  sendPreConsultReminder,
} from "@/lib/doctor-appointment-api";
import { supabase } from "@/lib/supabase";
import {
  getAppointmentReadiness,
  getAppointmentReadinessMessage,
  appointmentHasPreConsult,
} from "@/lib/appointment-readiness";
import { toast } from "sonner";
import type { AdminAppointment, AdminAppointmentStatus } from "@/types/admin-appointment";
import { UI_CHECKED_IN, UI_CHECK_IN } from "@/config/ui-labels";
import { ADMIN_STATUS_LABEL, WALK_IN_LABEL } from "@/types/admin-appointment";
import CancelDialog from "@/components/admin/appointments/CancelDialog";
import RescheduleDialog from "@/components/admin/appointments/RescheduleDialog";
import VitalSignsSheet from "@/components/admin/appointments/VitalSignsSheet";
import WalkInDialog from "@/components/admin/appointments/WalkInDialog";

type DateMode = "all" | "day" | "week" | "month";

const APPOINTMENT_LIST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DOCTOR_APPOINTMENTS_QUERY_KEY = ["doctor-appointments"] as const;

const ALL_STATUSES: { value: AdminAppointmentStatus | "__all__"; label: string }[] = [
  { value: "__all__",     label: "Tất cả trạng thái" },
  { value: "CONFIRMED",   label: "Chờ khám" },
  { value: "CHECKED_IN",  label: UI_CHECKED_IN },
  { value: "IN_PROGRESS", label: "Đang khám" },
  { value: "COMPLETED",   label: "Hoàn thành" },
  { value: "CANCELLED",   label: "Đã hủy" },
  { value: "NO_SHOW",     label: "Không đến" },
];

const RANGE_TABS: { value: DateMode; label: string }[] = [
  { value: "all",   label: "Tất cả" },
  { value: "day",   label: "Hôm nay" },
  { value: "week",  label: "Tuần này" },
  { value: "month", label: "Tháng này" },
];

// Portal Bác sĩ design palette
const STATUS_PILL: Record<AdminAppointmentStatus, string> = {
  CONFIRMED:   "bg-[#EAF0FF] text-[#1D4FD8]",
  CHECKED_IN:  "bg-[#E9F7EE] text-[#157F3D]",
  IN_PROGRESS: "bg-[#FFF4DD] text-[#A65F00]",
  COMPLETED:   "bg-[#F0EEEC] text-[#57524E]",
  CANCELLED:   "bg-[#FCEBEF] text-[#C41740]",
  NO_SHOW:     "bg-[#F5F4F2] text-[#7A726D]",
};

const STATUS_DOT: Record<string, string> = {
  CONFIRMED:   "bg-[#1D4FD8]",
  CHECKED_IN:  "bg-[#157F3D]",
  IN_PROGRESS: "bg-[#E3A21A]",
  COMPLETED:   "bg-[#9A928D]",
  CANCELLED:   "bg-[#C41740]",
  NO_SHOW:     "bg-[#7A726D]",
};

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const GRID_COLS =
  "grid grid-cols-[170px_minmax(0,1.6fr)_120px_100px_130px_200px] gap-3 px-4";
const AVATAR_CLASS =
  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E9F7EE] text-[12px] font-bold text-[#157F3D]";
const FLAG_CLASS =
  "whitespace-nowrap rounded-lg px-1.5 text-[10.5px] font-semibold";
const PAGE_BTN =
  "flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md border border-[#E1DDDA] bg-white px-1.5 text-[#1A1614] hover:bg-[#F5F4F2] disabled:cursor-not-allowed disabled:text-[#B5ADA8] disabled:hover:bg-white";

function avatarInitial(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[parts.length - 1]?.charAt(0) ?? "?").toUpperCase();
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

function describeSlot(row: AdminAppointment, todayKey: string) {
  const date = parseDate(row.slot_date) ?? (row.walk_in ? parseDate(row.created_at) : null);
  return {
    time: row.start_time ? row.start_time.slice(0, 5) : null,
    dateText: date ? `${WEEKDAY_SHORT[date.getDay()]} ${format(date, "dd/MM/yyyy")}` : "",
    isToday: date ? format(date, "yyyy-MM-dd") === todayKey : false,
  };
}

function patientSubline(row: AdminAppointment): string {
  const dob = parseDate(row.patient_dob);
  const age = dob ? `${differenceInYears(new Date(), dob)} tuổi` : null;
  return [row.patient_phone, age].filter(Boolean).join(" · ");
}

function dateRangeFor(mode: DateMode, anchor: Date): { dateFrom: string; dateTo: string; label: string } {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  if (mode === "day") {
    const s = fmt(anchor);
    return { dateFrom: s, dateTo: s, label: format(anchor, "dd/MM/yyyy", { locale: vi }) };
  }
  if (mode === "week") {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor,   { weekStartsOn: 1 });
    return {
      dateFrom: fmt(s), dateTo: fmt(e),
      label: `${format(s, "dd/MM")} – ${format(e, "dd/MM/yyyy", { locale: vi })}`,
    };
  }
  const s = startOfMonth(anchor);
  const e = endOfMonth(anchor);
  return {
    dateFrom: fmt(s), dateTo: fmt(e),
    label: format(anchor, "MM/yyyy", { locale: vi }),
  };
}

function stepAnchor(mode: DateMode, anchor: Date, dir: 1 | -1): Date {
  if (mode === "day")   return addDays(anchor, dir);
  if (mode === "week")  return addDays(anchor, dir * 7);
  const d = new Date(anchor);
  d.setMonth(d.getMonth() + dir);
  return d;
}

export default function ProviderAppointmentsPage() {
  const [mode, setMode] = useState<DateMode>("all");
  const [anchor, setAnchor] = useState(() => new Date());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [status, setStatus] = useState<string>("__all__");
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [vitalSignsAppt, setVitalSignsAppt] = useState<AdminAppointment | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { dateFrom, dateTo, label } = mode === "all"
    ? { dateFrom: undefined, dateTo: undefined, label: "Tất cả" }
    : dateRangeFor(mode, anchor);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setListPage(1);
  }, [debouncedSearch, status, dateFrom, dateTo, mode]);

  const listQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      page: listPage,
      limit: APPOINTMENT_LIST_PAGE_SIZE,
      status: status === "__all__" ? undefined : status,
      dateFrom,
      dateTo,
    }),
    [debouncedSearch, listPage, status, dateFrom, dateTo],
  );

  const { data: doctorSpecialtyId } = useQuery({
    queryKey: ["doctor-specialty-id"],
    queryFn: fetchDoctorSpecialtyId,
    staleTime: 60_000,
  });

  const {
    data: appointmentListData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [...DOCTOR_APPOINTMENTS_QUERY_KEY, listQueryParams],
    queryFn: async () => {
      const { rows, total, error } = await searchDoctorAppointments(listQueryParams);
      if (error) throw error;
      return { rows, total };
    },
    placeholderData: (previous) => previous,
  });

  // Counts next to each range tab ("Hôm nay", "Tuần này"… are relative to today),
  // respecting search + status; only the total is needed.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const { data: rangeCounts, refetch: refetchRangeCounts } = useQuery({
    queryKey: [...DOCTOR_APPOINTMENTS_QUERY_KEY, "range-counts", debouncedSearch, status, todayKey],
    queryFn: async () => {
      const entries = await Promise.all(
        RANGE_TABS.map(async ({ value }) => {
          const range = value === "all" ? null : dateRangeFor(value, new Date());
          const { total, error } = await searchDoctorAppointments({
            search: debouncedSearch || undefined,
            page: 1,
            limit: 1,
            status: status === "__all__" ? undefined : status,
            dateFrom: range?.dateFrom,
            dateTo: range?.dateTo,
          });
          if (error) throw error;
          return [value, total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<DateMode, number>;
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const filtered = appointmentListData?.rows ?? [];
  const appointmentTotal = appointmentListData?.total ?? 0;

  useEffect(() => {
    const selectedId = selected?.id;
    if (!selectedId) return;
    const updated = filtered.find((r) => r.id === selectedId);
    if (updated) setSelected(updated);
  }, [filtered, selected?.id]);
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

  const goToday = () => setAnchor(new Date());

  const warnIfNotReady = (row: AdminAppointment): boolean => {
    const readiness = getAppointmentReadiness(row);
    if (readiness.isReady) return true;
    toast.warning(getAppointmentReadinessMessage(readiness), { duration: 7000 });
    return false;
  };

  const handleCheckin = async (row: AdminAppointment): Promise<boolean> => {
    if (!warnIfNotReady(row)) return false;
    return doCheckin(row);
  };

  // Direct check-in without readiness check (used from popup where user just saved data)
  const doCheckin = async (row: AdminAppointment): Promise<boolean> => {
    setCheckingInId(row.id);
    try {
      const { error } = await supabase.rpc("admin_checkin_appointment", { p_appointment_id: row.id });
      if (error) throw error;
      void refetch();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tiếp nhận thất bại");
      return false;
    } finally {
      setCheckingInId(null);
    }
  };

  const handleExamination = async (row: AdminAppointment) => {
    if (row.status === "COMPLETED") {
      navigate(`/provider-portal/examination/${row.id}`);
      return;
    }
    if (!warnIfNotReady(row)) return;
    if (row.status === "CONFIRMED") {
      const ok = await handleCheckin(row);
      if (ok) navigate(`/provider-portal/examination/${row.id}`);
      return;
    }
    navigate(`/provider-portal/examination/${row.id}`);
  };

  const handleRowClick = (row: AdminAppointment) => {
    if (row.status === "COMPLETED") {
      void handleExamination(row);
      return;
    }
    setVitalSignsAppt(row);
  };

  const handleVitalSigns = (row: AdminAppointment) => {
    if (["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(row.status)) {
      setVitalSignsAppt(row);
    }
  };

  const handlePreConsultReminder = async (row: AdminAppointment) => {
    if (appointmentHasPreConsult(row)) {
      toast.info("Đã có khai báo trước khám (bệnh nhân hoặc bác sĩ).");
      return;
    }
    setRemindingId(row.id);
    try {
      const { emailSent, email, emailError } = await sendPreConsultReminder(row.id);
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
  };

  const handleRefresh = () => {
    void refetch();
    void refetchRangeCounts();
  };

  const renderActionsMenu = (row: AdminAppointment) => {
    const canCancel = !["CANCELLED", "COMPLETED"].includes(row.status);
    const canReschedule = ["CONFIRMED", "CHECKED_IN"].includes(row.status) && !row.walk_in;
    const canVitalSigns = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(row.status);
    const canRemindPreConsult =
      !appointmentHasPreConsult(row) &&
      ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(row.status);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Thao tác"
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-[#E1DDDA] bg-white text-[#4A4440] transition-colors hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {row.status === "COMPLETED" && (
            <DropdownMenuItem onClick={() => void handleExamination(row)}>
              <Stethoscope className="mr-2 h-4 w-4 text-primary" />
              Xem lại hồ sơ SOAP
            </DropdownMenuItem>
          )}
          {row.status === "CONFIRMED" && (<>
            <DropdownMenuItem
              disabled={checkingInId === row.id}
              onClick={() => void handleCheckin(row)}
            >
              {checkingInId === row.id
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <CalendarCheck className="mr-2 h-4 w-4 text-green-600" />}
              {UI_CHECK_IN}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={checkingInId === row.id}
              onClick={() => void handleExamination(row)}
            >
              {checkingInId === row.id
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Stethoscope className="mr-2 h-4 w-4 text-primary" />}
              Khám
            </DropdownMenuItem>
          </>)}
          {(row.status === "CHECKED_IN" || row.status === "IN_PROGRESS") && (
            <DropdownMenuItem onClick={() => void handleExamination(row)}>
              <Stethoscope className="mr-2 h-4 w-4 text-primary" />
              Khám bệnh (SOAP)
            </DropdownMenuItem>
          )}
          {canVitalSigns && (
            <DropdownMenuItem onClick={() => handleVitalSigns(row)}>
              <HeartPulse className="mr-2 h-4 w-4 text-teal-600" />
              Nhập sinh hiệu
            </DropdownMenuItem>
          )}
          {canRemindPreConsult && (
            <DropdownMenuItem
              disabled={remindingId === row.id}
              onClick={() => void handlePreConsultReminder(row)}
            >
              {remindingId === row.id
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Mail className="mr-2 h-4 w-4 text-pink-600" />}
              Nhắc nhở khai báo
            </DropdownMenuItem>
          )}
          {(canReschedule || canCancel) && <DropdownMenuSeparator />}
          {canReschedule && (
            <DropdownMenuItem onClick={() => { setSelected(row); setRescheduleOpen(true); }}>
              <CalendarClock className="mr-2 h-4 w-4 text-amber-500" />
              Đổi lịch
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { setSelected(row); setCancelOpen(true); }}
            >
              <CalendarX className="mr-2 h-4 w-4" />
              Hủy lịch
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderPrimaryAction = (row: AdminAppointment) => {
    if (row.status === "CONFIRMED") {
      return (
        <button
          type="button"
          onClick={() => setVitalSignsAppt(row)}
          className="h-[30px] cursor-pointer whitespace-nowrap rounded-[7px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {UI_CHECK_IN}
        </button>
      );
    }
    const label =
      row.status === "COMPLETED" ? "Xem phiếu"
        : row.status === "CHECKED_IN" || row.status === "IN_PROGRESS" ? "Khám"
          : null;
    if (!label) return null;
    return (
      <button
        type="button"
        disabled={checkingInId === row.id}
        onClick={() => void handleExamination(row)}
        className="h-[30px] cursor-pointer whitespace-nowrap rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-[12.5px] font-semibold text-[#1A1614] transition-colors hover:bg-[#FAF9F8] disabled:opacity-50"
      >
        {label}
      </button>
    );
  };

  const renderStatusPill = (row: AdminAppointment) => (
    <span className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[10px] px-2 py-[3px] text-[11.5px] font-semibold ${STATUS_PILL[row.status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ADMIN_STATUS_LABEL[row.status]}
    </span>
  );

  const renderPatientFlags = (row: AdminAppointment) => (
    <>
      {row.pre_consult_drug_allergy && (
        <span title="Dị ứng thuốc (khai báo trước khám)" className={FLAG_CLASS + " bg-[#FCEBEF] text-[#C41740]"}>
          Dị ứng thuốc
        </span>
      )}
      {row.pre_consult_severe_pain && (
        <span title="Đau dữ dội (khai báo trước khám)" className={FLAG_CLASS + " bg-[#FFF4DD] text-[#A65F00]"}>
          Đau dữ dội
        </span>
      )}
      {appointmentHasPreConsult(row) && (
        <span title="Đã khai báo y tế trước khám" className={FLAG_CLASS + " bg-[#E9F7EE] text-[#157F3D]"}>
          Có khai báo
        </span>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3 text-[13px] text-[#1A1614]">
      <div className="flex flex-col leading-[1.2]">
        <h1 className="text-base font-semibold">Lịch hẹn của tôi</h1>
        <span className="text-[11.5px] capitalize text-[#7A726D]">
          {format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi })}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex gap-0.5 rounded-lg bg-[#EDEAE7] p-[3px]" role="tablist" aria-label="Khoảng thời gian">
          {RANGE_TABS.map(({ value, label: tabLabel }) => {
            const active = mode === value;
            const count = rangeCounts?.[value];
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setMode(value); setAnchor(new Date()); }}
                className={`flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12.5px] font-semibold transition-colors ${
                  active ? "bg-white text-[#1A1614] shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-[#7A726D] hover:text-[#1A1614]"
                }`}
              >
                {tabLabel}
                {count !== undefined && (
                  <span className="text-[11px] font-medium text-[#9A928D]">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {mode !== "all" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Trước"
              onClick={() => setAnchor((a) => stepAnchor(mode, a, -1))}
              className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-[#E1DDDA] bg-white text-[#4A4440] hover:bg-[#FAF9F8]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-[12.5px] font-semibold">{label}</span>
            <button
              type="button"
              aria-label="Sau"
              onClick={() => setAnchor((a) => stepAnchor(mode, a, 1))}
              className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-[#E1DDDA] bg-white text-[#4A4440] hover:bg-[#FAF9F8]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-[34px] cursor-pointer whitespace-nowrap rounded-lg px-2 text-[12px] font-medium text-[#7A726D] hover:text-primary"
            >
              Hôm nay
            </button>
          </div>
        )}

        <label className="flex h-[34px] min-w-[200px] max-w-[360px] flex-1 items-center gap-2 rounded-lg border border-[#E1DDDA] bg-white px-3 text-[#7A726D] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Tìm bệnh nhân</span>
          <input
            placeholder="Tìm bệnh nhân (tên, SĐT)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#1A1614] outline-none placeholder:text-[#9A928D]"
          />
        </label>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger
            className={`h-[34px] w-auto min-w-[190px] gap-2 rounded-lg bg-white text-[13px] font-medium ${
              status !== "__all__" ? "border-primary" : "border-[#E1DDDA]"
            }`}
            aria-label="Lọc theo trạng thái"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-[#B5ADA8]"}`} />
            <span className="flex-1 text-left"><SelectValue /></span>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="whitespace-nowrap text-[12px] text-[#7A726D]">
          {appointmentTotal} lịch hẹn
          {isFetching && !isLoading ? (
            <Loader2 className="ml-1 inline h-3 w-3 animate-spin" aria-hidden="true" />
          ) : null}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          disabled={isFetching}
          onClick={handleRefresh}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] border border-[#D9D5D1] bg-white px-3 font-medium transition-colors hover:bg-[#FAF9F8] disabled:opacity-60"
        >
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Làm mới
        </button>
        <button
          type="button"
          onClick={() => setWalkInOpen(true)}
          className="flex h-8 cursor-pointer items-center gap-1 rounded-[7px] bg-primary px-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {WALK_IN_LABEL}
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-[10px] border border-[#E8E5E2] bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#7A726D]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-[#7A726D]">
            {debouncedSearch || status !== "__all__"
              ? "Không có lịch hẹn phù hợp bộ lọc."
              : "Không có lịch hẹn nào trong khoảng thời gian này."}
          </p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="divide-y divide-[#F0EDEB] md:hidden">
              {filtered.map((row) => {
                const { time, dateText, isToday } = describeSlot(row, todayKey);
                return (
                  <div
                    key={row.id}
                    className={`cursor-pointer p-4 transition-colors hover:bg-[#FBFAF9] ${isToday ? "bg-[#FFF8F9] shadow-[inset_3px_0_0_hsl(var(--primary))]" : ""}`}
                    onClick={() => handleRowClick(row)}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        {time
                          ? <span className="font-mono text-[15px] font-semibold">{time}</span>
                          : <span className="text-[12px] font-semibold text-[#A65F00]">{WALK_IN_LABEL}</span>}
                        <span className="text-[12px] text-[#7A726D]">{dateText}</span>
                      </div>
                      {renderStatusPill(row)}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={AVATAR_CLASS}>{avatarInitial(row.patient_name)}</span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate font-semibold">{row.patient_name ?? "—"}</p>
                        <p className="text-[11.5px] text-[#7A726D]">{patientSubline(row)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{renderPatientFlags(row)}</div>
                    <div className="mt-3 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {renderPrimaryAction(row)}
                      {renderActionsMenu(row)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop grid view */}
            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[920px]" role="table" aria-label="Danh sách lịch hẹn">
                <div
                  role="row"
                  className={`${GRID_COLS} border-b border-[#EFECEA] bg-[#FAF9F8] py-[9px] text-[11px] font-semibold uppercase tracking-[.04em] text-[#7A726D]`}
                >
                  <span role="columnheader">Ngày · Giờ</span>
                  <span role="columnheader">Bệnh nhân</span>
                  <span role="columnheader">Chuyên khoa</span>
                  <span role="columnheader">Loại</span>
                  <span role="columnheader">Trạng thái</span>
                  <span role="columnheader" className="text-right">Thao tác</span>
                </div>
                {filtered.map((row) => {
                  const { time, dateText, isToday } = describeSlot(row, todayKey);
                  return (
                    <div
                      key={row.id}
                      role="row"
                      onClick={() => handleRowClick(row)}
                      className={`${GRID_COLS} min-h-[52px] cursor-pointer items-center border-b border-[#F0EDEB] py-2 transition-colors last:border-b-0 ${
                        isToday
                          ? "bg-[#FFF8F9] shadow-[inset_3px_0_0_hsl(var(--primary))] hover:bg-[#FFF2F5]"
                          : "hover:bg-[#FBFAF9]"
                      }`}
                    >
                      <div role="cell" className="flex items-baseline gap-2">
                        {time
                          ? <span className="font-mono text-[13.5px] font-semibold">{time}</span>
                          : <span className="text-[11.5px] font-semibold text-[#A65F00]">{WALK_IN_LABEL}</span>}
                        <span className="whitespace-nowrap text-[12px] text-[#7A726D]">{dateText}</span>
                      </div>
                      <div role="cell" className="flex min-w-0 items-center gap-2.5">
                        <span className={AVATAR_CLASS}>{avatarInitial(row.patient_name)}</span>
                        <div className="flex min-w-0 flex-col leading-[1.3]">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold">{row.patient_name ?? "—"}</span>
                            {renderPatientFlags(row)}
                          </div>
                          <span className="text-[11.5px] text-[#7A726D]">{patientSubline(row)}</span>
                        </div>
                      </div>
                      <span role="cell" className="truncate text-[#4A4440]">{row.specialty_name ?? "—"}</span>
                      <span role="cell" className="text-[#4A4440]">{row.walk_in ? "Không hẹn" : "Có hẹn"}</span>
                      <div role="cell">{renderStatusPill(row)}</div>
                      <div role="cell" className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {renderPrimaryAction(row)}
                        {renderActionsMenu(row)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {appointmentTotal > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECEA] bg-[#FAF9F8] px-4 py-[9px] text-[12px] text-[#7A726D]">
            <span>
              Hiển thị{" "}
              <b className="font-semibold text-[#1A1614]">{appointmentFrom}–{appointmentTo}</b>
              {" "}/ {appointmentTotal} lịch hẹn
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={listPage <= 1 || isFetching}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                className={PAGE_BTN}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[56px] text-center font-medium">
                {listPage}/{appointmentTotalPages}
              </span>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={listPage >= appointmentTotalPages || isFetching}
                onClick={() => setListPage((p) => Math.min(appointmentTotalPages, p + 1))}
                className={PAGE_BTN}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selected && (
        <CancelDialog
          appointment={selected}
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onSuccess={() => { setCancelOpen(false); handleRefresh(); }}
        />
      )}

      {selected && rescheduleOpen && (
        <RescheduleDialog
          appointment={selected}
          open={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          onSuccess={() => { setRescheduleOpen(false); handleRefresh(); }}
        />
      )}

      <VitalSignsSheet
        appointment={vitalSignsAppt}
        onClose={() => setVitalSignsAppt(null)}
        onCheckIn={async (appt) => {
          // Refetch to get latest data before checking readiness
          const { data } = await refetch();
          const freshAppt = data?.rows.find(r => r.id === appt.id);
          if (!freshAppt) {
            toast.error("Không tìm thấy lịch hẹn");
            return;
          }
          const ok = await handleCheckin(freshAppt);
          if (ok) setVitalSignsAppt(null);
        }}
        onReschedule={(appt) => {
          setSelected(appt);
          setRescheduleOpen(true);
          setVitalSignsAppt(null);
        }}
        onCancelAppointment={(appt) => {
          setSelected(appt);
          setCancelOpen(true);
          setVitalSignsAppt(null);
        }}
        onViewPatientRecords={(appt) => {
          navigate(`/provider-portal/patients?patient=${appt.profile_id}`);
          setVitalSignsAppt(null);
        }}
        onRefresh={() => {
          void refetch().then(() => {
            if (vitalSignsAppt) {
              const updated = appointmentListData?.rows.find(r => r.id === vitalSignsAppt.id);
              if (updated) setVitalSignsAppt(updated);
            }
          });
        }}
      />

      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onSuccess={() => { setWalkInOpen(false); handleRefresh(); }}
        portal="provider"
        defaultSpecialtyId={doctorSpecialtyId ?? undefined}
        lockSpecialty={Boolean(doctorSpecialtyId)}
      />

    </div>
  );
}
