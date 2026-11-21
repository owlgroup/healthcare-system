import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInYears, parseISO } from "date-fns";
import { Loader2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import CancelDialog from "./CancelDialog";
import RescheduleDialog from "./RescheduleDialog";
import PatientRecordDialog from "./PatientRecordDialog";
import AdminCreateProfileDialog from "./AdminCreateProfileDialog";
import PreConsultationDualView from "@/components/pre-consultation/PreConsultationDualView";
import type { AdminAppointment, AdminAppointmentStatus } from "@/types/admin-appointment";
import { ADMIN_STATUS_LABEL } from "@/types/admin-appointment";
import { adminCheckinAppointment } from "@/lib/admin-appointment-api";
import { sendPreConsultReminder } from "@/lib/doctor-appointment-api";
import {
  getAppointmentReadiness,
  getAppointmentReadinessMessage,
} from "@/lib/appointment-readiness";
import { listVitalSignsByAppointment, recordVitalSigns } from "@/lib/vital-signs-api";
import { supabase } from "@/lib/supabase";
import { isOutOfRange, VITAL_RANGES, type VitalSignsRow } from "@/types/vital-signs";
import { toast } from "sonner";
import { UI_WALK_IN } from "@/config/ui-labels";

interface Props {
  appointment: AdminAppointment | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  initialTab?: DetailTab;
}

type DetailTab = "info" | "decl" | "vitals";

const TABS: { id: DetailTab; label: string }[] = [
  { id: "info", label: "Thông tin" },
  { id: "decl", label: "Khai báo trước khám" },
  { id: "vitals", label: "Sinh hiệu" },
];

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const STATUS_PILL: Record<AdminAppointmentStatus, string> = {
  CONFIRMED: "bg-[#E8F0FE] text-[#1D4ED8]",
  CHECKED_IN: "bg-[#E9F7EE] text-[#157F3D]",
  IN_PROGRESS: "bg-[#F1ECFD] text-[#6D3FC9]",
  COMPLETED: "bg-[#EDEAE7] text-[#4A4440]",
  CANCELLED: "bg-[#FCEBEF] text-[#C41740]",
  NO_SHOW: "bg-[#FFF4DD] text-[#A65F00]",
};

const fieldClass =
  "h-8 w-[70px] rounded-[7px] border border-[#E1DDDA] bg-[#FAF9F8] px-2 text-right text-sm text-[#1A1614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]";

function parseNum(value: string): number | null {
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatPrevDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd/MM");
}

function trendMark(value: number, min: number, max: number): string {
  if (value < min) return "▼ ";
  if (value > max) return "▲ ";
  return "";
}

export default function AppointmentDetailSheet({
  appointment, open, onClose, onRefresh, initialTab = "info",
}: Props) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createProfileOpen, setCreateProfileOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [vitals, setVitals] = useState({
    bp_systolic: "",
    bp_diastolic: "",
    heart_rate: "",
    spo2: "",
    temperature_c: "",
    respiratory_rate: "",
    weight_kg: "",
    height_cm: "",
    clinical_note: "",
  });

  useEffect(() => {
    setActiveTab(initialTab);
    setVitals({
      bp_systolic: "",
      bp_diastolic: "",
      heart_rate: "",
      spo2: "",
      temperature_c: "",
      respiratory_rate: "",
      weight_kg: "",
      height_cm: "",
      clinical_note: "",
    });
  }, [appointment?.id, initialTab]);

  useEffect(() => {
    if (!open || !appointment?.profile_id) {
      setHasProfile(null);
      return;
    }
    setHasProfile(null);
    supabase
      .from("patient")
      .select("id, id_document_storage_path")
      .eq("id", appointment.profile_id)
      .maybeSingle()
      .then(({ data }) => setHasProfile(Boolean(data?.id_document_storage_path)));
  }, [open, appointment?.profile_id]);

  const { data: history = [] } = useQuery({
    queryKey: ["vital_signs", appointment?.id],
    queryFn: () => listVitalSignsByAppointment(supabase, appointment!.id).then((r) => r.vitals),
    enabled: open && Boolean(appointment?.id),
  });

  const latest = history[0];

  const saveVitals = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("No appointment");
      const { result, error } = await recordVitalSigns(supabase, {
        appointment_id: appointment.id,
        bp_systolic: parseNum(vitals.bp_systolic),
        bp_diastolic: parseNum(vitals.bp_diastolic),
        heart_rate: parseNum(vitals.heart_rate),
        temperature_c: parseNum(vitals.temperature_c),
        respiratory_rate: parseNum(vitals.respiratory_rate),
        spo2: parseNum(vitals.spo2),
        weight_kg: parseNum(vitals.weight_kg),
        height_cm: parseNum(vitals.height_cm),
        clinical_note: vitals.clinical_note.trim() || null,
      });
      if (error) throw error;
      return result!;
    },
    onSuccess: (result) => {
      if (result.is_critical) {
        toast.error("Sinh hiệu nguy kịch — thông báo đến bác sĩ ngay.", {
          duration: 8000,
          description: result.critical_flags.join(" · "),
        });
      } else {
        toast.success("Đã lưu sinh hiệu.");
      }
      void queryClient.invalidateQueries({ queryKey: ["vital_signs", appointment?.id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      onRefresh();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Lưu sinh hiệu thất bại.");
    },
  });

  const schedule = useMemo(() => {
    if (!appointment?.slot_date) return null;
    const date = parseISO(appointment.slot_date);
    if (Number.isNaN(date.getTime())) return null;
    return {
      weekday: WEEKDAY[date.getDay()],
      dateText: format(date, "dd/MM/yyyy"),
      time: appointment.start_time?.slice(0, 5) ?? null,
    };
  }, [appointment?.slot_date, appointment?.start_time]);

  if (!appointment) return null;

  const initials = appointment.patient_name
    ? appointment.patient_name.trim().split(" ").pop()?.charAt(0).toUpperCase() ?? "?"
    : "?";
  const age = appointment.patient_dob
    ? differenceInYears(new Date(), parseISO(appointment.patient_dob))
    : null;
  const dobText = appointment.patient_dob
    ? format(parseISO(appointment.patient_dob), "dd/MM/yyyy")
    : "—";
  const patientCode = appointment.profile_id
    ? `BN-${appointment.profile_id.slice(0, 8).toUpperCase()}`
    : "—";
  const readiness = getAppointmentReadiness(appointment);
  const canCheckin = appointment.status === "CONFIRMED";
  const canCancel = !["CANCELLED", "COMPLETED"].includes(appointment.status);
  const canReschedule = ["CONFIRMED", "CHECKED_IN"].includes(appointment.status) && !appointment.walk_in;
  const tabIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const hasNext = tabIndex < TABS.length - 1;

  const handleCheckin = async () => {
    if (!readiness.isReady) {
      toast.warning(getAppointmentReadinessMessage(readiness), { duration: 7000 });
      return;
    }
    setCheckingIn(true);
    try {
      await adminCheckinAppointment(appointment.id);
      toast.success("Tiếp nhận thành công.");
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tiếp nhận thất bại.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleRemind = async () => {
    setReminding(true);
    try {
      const { emailSent, emailError } = await sendPreConsultReminder(appointment.id);
      if (!emailSent) {
        toast.error(emailError || "Không gửi được nhắc khai báo.");
        return;
      }
      toast.success("Đã gửi nhắc khai báo trước khám.");
    } finally {
      setReminding(false);
    }
  };

  const subtitle = [
    "Tiếp nhận",
    schedule?.time,
    schedule ? `${schedule.weekday} ${schedule.dateText}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent
          hideClose
          overlayClassName="bg-[rgba(26,22,20,0.32)]"
          className="flex max-h-[calc(100vh-48px)] w-[min(760px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-[14px] border-0 bg-[#F5F4F2] p-0 shadow-[0_24px_64px_rgba(26,22,20,0.28)]"
        >
          <DialogDescription className="sr-only">
            Chi tiết lịch hẹn, khai báo trước khám và sinh hiệu.
          </DialogDescription>
          <header className="flex items-center gap-3 border-b border-[#E8E5E2] bg-white px-5 py-3.5">
            <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] bg-[#C41740] text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[11.5px] text-[#7A726D]">{subtitle}</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <DialogTitle className="truncate text-[15px] font-bold text-[#1A1614]">
                  {appointment.patient_name || "Bệnh nhân"}
                </DialogTitle>
                <span className="shrink-0 font-mono text-[11px] text-[#7A726D]">{patientCode}</span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_PILL[appointment.status]}`}>
              {ADMIN_STATUS_LABEL[appointment.status]}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[7px] border border-[#E1DDDA] bg-white text-[#4A4440] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="border-b border-[#E8E5E2] bg-white px-5 py-2.5">
            <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-[#EDEAE7] p-[3px]" role="tablist" aria-label="Nội dung lịch hẹn">
              {TABS.map((tab, index) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`appt-tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`appt-panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex h-[30px] cursor-pointer items-center justify-center gap-1.5 rounded-md text-[12.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] ${
                      selected
                        ? "bg-white text-[#C41740] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        : "bg-transparent text-[#7A726D] hover:text-[#4A4440]"
                    }`}
                  >
                    <span className="text-[11px] opacity-70">{index + 1}</span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {activeTab === "info" && (
              <div id="appt-panel-info" role="tabpanel" aria-labelledby="appt-tab-info" className="space-y-3">
                <div className="grid overflow-hidden rounded-[10px] border border-[#E8E5E2] bg-white sm:grid-cols-3">
                  <InfoCell label="Ngày sinh" value={age != null ? `${dobText} · ${age} tuổi` : dobText} />
                  <InfoCell label="Điện thoại" value={appointment.patient_phone || "—"} mono />
                  <InfoCell label="Chuyên khoa" value={appointment.specialty_name || "—"} />
                  <div className="flex flex-col gap-0.5 border-[#EFECEA] bg-[#FFF8F9] px-3.5 py-3 sm:border-r">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#C41740]">Giờ hẹn</span>
                    <span className="font-mono text-lg font-bold text-[#C41740]">
                      {schedule?.time ?? (appointment.walk_in ? UI_WALK_IN : "—")}
                    </span>
                    {schedule && (
                      <span className="text-xs text-[#4A4440]">{schedule.weekday}, {schedule.dateText}</span>
                    )}
                  </div>
                  <InfoCell
                    label="Bác sĩ"
                    value={appointment.doctor_name || "—"}
                    hint={appointment.walk_in ? "Khám không hẹn" : "Khám có hẹn"}
                  />
                  <InfoCell label="Mã bệnh nhân" value={patientCode} mono />
                </div>

                <div className="flex flex-col gap-2 rounded-[10px] border border-[#E8E5E2] bg-white px-3.5 py-3">
                  <p className="font-semibold text-[#1A1614]">Kiểm tra trước khi tiếp nhận</p>
                  <CheckRow
                    label="Khai báo trước khám"
                    chip={readiness.hasPreConsult ? "Đã có" : "Chưa có"}
                    tone={readiness.hasPreConsult ? "ok" : "wait"}
                  />
                  <CheckRow
                    label="Sinh hiệu hôm nay"
                    chip={readiness.hasVitalSigns || history.length > 0 ? "Đã nhập" : "Chưa nhập"}
                    tone={readiness.hasVitalSigns || history.length > 0 ? "ok" : "wait"}
                  />
                  <CheckRow
                    label={latest ? `Lần đo gần nhất (${formatPrevDate(latest.recorded_at)})` : "Lần đo gần nhất"}
                    chip={latestSummary(latest)}
                    tone={latest?.is_critical ? "alert" : "muted"}
                  />
                </div>

                {appointment.status === "CANCELLED" && appointment.cancel_reason && (
                  <p className="rounded-[10px] border border-[#F3C9D3] bg-[#FCEBEF] px-3.5 py-3 text-sm text-[#C41740]" role="alert">
                    Lý do hủy: {appointment.cancel_reason}
                  </p>
                )}
              </div>
            )}

            {activeTab === "decl" && (
              <div id="appt-panel-decl" role="tabpanel" aria-labelledby="appt-tab-decl">
                <PreConsultationDualView
                  appointmentId={appointment.id}
                  appointmentStatus={appointment.status}
                  layout="intake"
                  onRemind={canCheckin ? handleRemind : undefined}
                  reminding={reminding}
                  onSaved={onRefresh}
                />
              </div>
            )}

            {activeTab === "vitals" && (
              <div id="appt-panel-vitals" role="tabpanel" aria-labelledby="appt-tab-vitals" className="space-y-3">
                <div className="overflow-hidden rounded-[10px] border border-[#E8E5E2] bg-white">
                  <div className="hidden grid-cols-[150px_minmax(0,1fr)_150px] gap-3 border-b border-[#EFECEA] bg-[#FAF9F8] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#7A726D] sm:grid">
                    <span>Chỉ số</span>
                    <span>Giá trị</span>
                    <span>Lần trước{latest ? ` · ${formatPrevDate(latest.recorded_at)}` : ""}</span>
                  </div>
                  <VitalRow label="Huyết áp" unit="mmHg" previous={bpPrevious(latest)}>
                    <input aria-label="Huyết áp tâm thu" inputMode="numeric" placeholder="120" className={fieldClass} value={vitals.bp_systolic} onChange={(e) => setVitals((v) => ({ ...v, bp_systolic: e.target.value }))} />
                    <span className="text-[#7A726D]">/</span>
                    <input aria-label="Huyết áp tâm trương" inputMode="numeric" placeholder="80" className={fieldClass} value={vitals.bp_diastolic} onChange={(e) => setVitals((v) => ({ ...v, bp_diastolic: e.target.value }))} />
                  </VitalRow>
                  <VitalRow label="Nhịp tim" unit="bpm" previous={numPrevious(latest?.heart_rate, "heart_rate")}>
                    <input aria-label="Nhịp tim" inputMode="numeric" placeholder="—" className={fieldClass} value={vitals.heart_rate} onChange={(e) => setVitals((v) => ({ ...v, heart_rate: e.target.value }))} />
                  </VitalRow>
                  <VitalRow label="SpO₂" unit="%" previous={numPrevious(latest?.spo2, "spo2")}>
                    <input aria-label="SpO2" inputMode="numeric" placeholder="—" className={fieldClass} value={vitals.spo2} onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))} />
                  </VitalRow>
                  <VitalRow label="Nhiệt độ" unit="°C" previous={numPrevious(latest?.temperature_c, "temperature_c")}>
                    <input aria-label="Nhiệt độ" inputMode="decimal" placeholder="—" className={fieldClass} value={vitals.temperature_c} onChange={(e) => setVitals((v) => ({ ...v, temperature_c: e.target.value }))} />
                  </VitalRow>
                  <VitalRow label="Nhịp thở" unit="l/ph" previous={numPrevious(latest?.respiratory_rate, "respiratory_rate")}>
                    <input aria-label="Nhịp thở" inputMode="numeric" placeholder="—" className={fieldClass} value={vitals.respiratory_rate} onChange={(e) => setVitals((v) => ({ ...v, respiratory_rate: e.target.value }))} />
                  </VitalRow>
                  <VitalRow label="Cân nặng · Chiều cao" previous={bodyPrevious(latest)} last>
                    <input aria-label="Cân nặng" inputMode="decimal" placeholder="kg" className={fieldClass} value={vitals.weight_kg} onChange={(e) => setVitals((v) => ({ ...v, weight_kg: e.target.value }))} />
                    <input aria-label="Chiều cao" inputMode="decimal" placeholder="cm" className={fieldClass} value={vitals.height_cm} onChange={(e) => setVitals((v) => ({ ...v, height_cm: e.target.value }))} />
                  </VitalRow>
                </div>
                <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#E8E5E2] bg-white px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1A1614]">Ghi chú lâm sàng</span>
                    <span className="text-[11px] text-[#9A928D]">{vitals.clinical_note.length}/500</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={vitals.clinical_note}
                    onChange={(e) => setVitals((v) => ({ ...v, clinical_note: e.target.value }))}
                    placeholder="Nhập quan sát bổ sung…"
                    className="resize-y rounded-[7px] border border-[#E1DDDA] bg-[#FAF9F8] px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveVitals.mutate()}
                      disabled={saveVitals.isPending}
                      className="h-[30px] cursor-pointer rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-xs font-semibold text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saveVitals.isPending ? "Đang lưu…" : "Lưu sinh hiệu"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-[#E8E5E2] bg-white px-5 py-3">
            {hasProfile === false ? (
              <FooterButton onClick={() => setCreateProfileOpen(true)}>Tạo hồ sơ</FooterButton>
            ) : (
              <FooterButton onClick={() => setProfileOpen(true)} disabled={hasProfile === null}>
                Xem hồ sơ
              </FooterButton>
            )}
            {canReschedule && (
              <FooterButton onClick={() => setRescheduleOpen(true)}>Đổi lịch</FooterButton>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="h-[34px] cursor-pointer rounded-[7px] border border-[#F3C9D3] bg-white px-3 text-sm font-medium text-[#C41740] transition-colors duration-200 hover:bg-[#FFF8F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
              >
                Hủy lịch
              </button>
            )}
            <div className="min-w-2 flex-1" />
            {hasNext && (
              <button
                type="button"
                onClick={() => setActiveTab(TABS[tabIndex + 1].id)}
                className="h-[34px] cursor-pointer rounded-[7px] px-3 text-sm font-semibold text-[#4A4440] transition-colors duration-200 hover:bg-[#F5F4F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
              >
                Bước tiếp →
              </button>
            )}
            {canCheckin && (
              <button
                type="button"
                onClick={handleCheckin}
                disabled={checkingIn || hasProfile === false || hasProfile === null}
                className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] bg-[#C41740] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                Tiếp nhận
              </button>
            )}
          </footer>
        </DialogContent>
      </Dialog>

      <CancelDialog
        appointment={appointment}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onSuccess={() => { setCancelOpen(false); onRefresh(); onClose(); }}
        nested
      />
      {rescheduleOpen && (
        <RescheduleDialog
          appointment={appointment}
          open={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          onSuccess={() => { setRescheduleOpen(false); onRefresh(); onClose(); }}
          nested
        />
      )}
      <PatientRecordDialog
        profileId={appointment.profile_id}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onProfileResolved={setHasProfile}
        onCreateProfile={() => { setProfileOpen(false); setCreateProfileOpen(true); }}
        nested
      />
      <AdminCreateProfileDialog
        open={createProfileOpen}
        onClose={() => setCreateProfileOpen(false)}
        onSuccess={() => {
          setCreateProfileOpen(false);
          setHasProfile(true);
          onRefresh();
        }}
        profileId={appointment.profile_id}
        patientUserId={appointment.patient_id}
        patientName={appointment.patient_name}
        nested
      />
    </>
  );
}

function InfoCell({
  label, value, hint, mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-[#EFECEA] px-3.5 py-3 sm:border-b sm:border-r sm:[&:nth-child(3n)]:border-r-0 sm:[&:nth-child(n+4)]:border-b-0">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9A928D]">{label}</span>
      <span className={`font-medium text-[#1A1614] ${mono ? "font-mono" : ""}`}>{value}</span>
      {hint && <span className="text-xs text-[#7A726D]">{hint}</span>}
    </div>
  );
}

function CheckRow({
  label, chip, tone,
}: {
  label: string;
  chip: string;
  tone: "wait" | "ok" | "alert" | "muted";
}) {
  const chipClass = {
    wait: "bg-[#FFF4DD] text-[#A65F00]",
    ok: "bg-[#E9F7EE] text-[#157F3D]",
    alert: "bg-[#FCEBEF] text-[#C41740]",
    muted: "bg-[#EDEAE7] text-[#4A4440]",
  }[tone];
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#F0EDEB] py-1.5">
      <span className="text-sm text-[#4A4440]">{label}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${chipClass}`}>{chip}</span>
    </div>
  );
}

function VitalRow({
  label, unit, previous, children, last,
}: {
  label: string;
  unit?: string;
  previous: { text: string; alert: boolean };
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`grid items-center gap-2 px-3.5 py-2 sm:grid-cols-[150px_minmax(0,1fr)_150px] sm:gap-3 ${last ? "" : "border-b border-[#F0EDEB]"}`}>
      <span className="font-medium text-[#1A1614]">{label}</span>
      <div className="flex items-center gap-1.5">
        {children}
        {unit && <span className="text-xs text-[#7A726D]">{unit}</span>}
      </div>
      <span className={`text-sm ${previous.alert ? "font-semibold text-[#C41740]" : "text-[#4A4440]"}`}>
        {previous.text}
      </span>
    </div>
  );
}

function FooterButton({
  children, onClick, disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[34px] cursor-pointer rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-sm font-medium text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function latestSummary(latest: VitalSignsRow | undefined): string {
  if (!latest) return "Chưa có";
  const parts = [
    latest.spo2 != null ? `SpO₂ ${latest.spo2}%` : null,
    latest.respiratory_rate != null ? `Nhịp thở ${latest.respiratory_rate}` : null,
    latest.heart_rate != null ? `Nhịp tim ${latest.heart_rate}` : null,
  ].filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(" · ") : "Đã đo";
}

function bpPrevious(latest: VitalSignsRow | undefined): { text: string; alert: boolean } {
  if (!latest || latest.bp_systolic == null || latest.bp_diastolic == null) return { text: "—", alert: false };
  const alert = isOutOfRange("bp_systolic", latest.bp_systolic) || isOutOfRange("bp_diastolic", latest.bp_diastolic);
  const mark = trendMark(latest.bp_systolic, VITAL_RANGES.bp_systolic.min, VITAL_RANGES.bp_systolic.max);
  return { text: `${mark}${latest.bp_systolic}/${latest.bp_diastolic}`, alert };
}

function numPrevious(
  value: number | null | undefined,
  key: keyof typeof VITAL_RANGES,
): { text: string; alert: boolean } {
  if (value == null) return { text: "—", alert: false };
  const range = VITAL_RANGES[key];
  const alert = isOutOfRange(key, value);
  return { text: `${trendMark(value, range.min, range.max)}${value}`, alert };
}

function bodyPrevious(latest: VitalSignsRow | undefined): { text: string; alert: boolean } {
  if (!latest || (latest.weight_kg == null && latest.height_cm == null)) return { text: "—", alert: false };
  const weight = latest.weight_kg != null ? `${latest.weight_kg} kg` : "—";
  const height = latest.height_cm != null ? `${latest.height_cm} cm` : "—";
  return { text: `${weight} · ${height}`, alert: false };
}
