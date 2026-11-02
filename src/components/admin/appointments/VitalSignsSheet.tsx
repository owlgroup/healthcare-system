import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Activity, Clock, AlertTriangle, Calendar, Save, Phone, Stethoscope,
  User, FileText, CalendarDays, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listVitalSignsByAppointment, recordVitalSigns } from "@/lib/vital-signs-api";
import PreConsultationDualView from "@/components/pre-consultation/PreConsultationDualView";
import { supabase } from "@/lib/supabase";
import type { AdminAppointment } from "@/types/admin-appointment";
import type { VitalSignsRow, RecordVitalSignsInput } from "@/types/vital-signs";
import VitalSignsFormContent from "./VitalSignsFormContent";
import PatientRecordDialog from "./PatientRecordDialog";

type VitalSignsSheetProps = {
  appointment: AdminAppointment | null;
  onClose: () => void;
  onCheckIn?: (appointment: AdminAppointment) => void;
  onReschedule?: (appointment: AdminAppointment) => void;
  onCancelAppointment?: (appointment: AdminAppointment) => void;
  onViewPatientRecords?: (appointment: AdminAppointment) => void;
  onRefresh?: () => void;
};

function fmt(v: number | null, unit: string) {
  return v != null ? `${v} ${unit}` : "—";
}

function HistoryCard({ v }: { v: VitalSignsRow }) {
  const time = new Date(v.recorded_at).toLocaleString("vi-VN", {
    dateStyle: "short", timeStyle: "short",
  });

  const items = [
    v.bp_systolic != null && v.bp_diastolic != null
      ? { label: "HA", value: `${v.bp_systolic}/${v.bp_diastolic} mmHg` }
      : null,
    v.heart_rate != null   ? { label: "Nhịp tim",  value: fmt(v.heart_rate, "bpm") } : null,
    v.temperature_c != null ? { label: "Nhiệt độ",  value: fmt(v.temperature_c, "°C") } : null,
    v.spo2 != null          ? { label: "SpO2",       value: fmt(v.spo2, "%") } : null,
    v.respiratory_rate != null ? { label: "Nhịp thở", value: fmt(v.respiratory_rate, "l/ph") } : null,
    v.weight_kg != null     ? { label: "Cân nặng",  value: fmt(v.weight_kg, "kg") } : null,
    v.height_cm != null     ? { label: "Chiều cao", value: fmt(v.height_cm, "cm") } : null,
    v.bmi != null           ? { label: "BMI",        value: String(v.bmi) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className={`rounded-xl border p-3 text-xs space-y-2 ${v.is_critical ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {time}
        </span>
        {v.is_critical && (
          <span className="flex items-center gap-1 font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" />
            CRITICAL
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
      {v.clinical_note && (
        <p className="text-muted-foreground italic border-t pt-1.5 mt-1">"{v.clinical_note}"</p>
      )}
    </div>
  );
}

function toStr(v: number | null | undefined): string {
  return v != null ? String(v) : "";
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ── Tab: Thông tin ────────────────────────────────────────────────────────────
function InfoTab({
  appointment,
  onCheckIn,
  onReschedule,
  onCancel,
  onViewPatientRecords,
}: {
  appointment: AdminAppointment;
  onCheckIn?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  onViewPatientRecords?: () => void;
}) {
  const patientCode = `BN-${appointment.profile_id.slice(0, 8).toUpperCase()}`;

  // Safe date parsing - combine slot_date and start_time
  // start_time can be either full timestamp or time-only (e.g., "08:30:00")
  let appointmentDate: string | null = null;
  let appointmentTime: string | null = null;

  if (appointment.slot_date) {
    const slotDate = new Date(appointment.slot_date + "T00:00:00");
    if (!isNaN(slotDate.getTime())) {
      appointmentDate = slotDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }

  if (appointment.start_time) {
    // Check if start_time is time-only (HH:mm:ss) or full timestamp
    const isTimeOnly = /^\d{2}:\d{2}(:\d{2})?$/.test(appointment.start_time);
    if (isTimeOnly) {
      // Time-only format like "08:30:00"
      const [hours, minutes] = appointment.start_time.split(":");
      appointmentTime = `${hours}:${minutes}`;
    } else {
      // Full timestamp
      const startTime = new Date(appointment.start_time);
      if (!isNaN(startTime.getTime())) {
        appointmentTime = startTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        // Also use date from start_time if slot_date wasn't available
        if (!appointmentDate) {
          appointmentDate = startTime.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
        }
      }
    }
  }

  // Calculate age and format patient_dob
  const dob = appointment.patient_dob ? new Date(appointment.patient_dob) : null;
  const isValidDob = dob && !isNaN(dob.getTime());
  const age = isValidDob
    ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const dobFormatted = isValidDob
    ? dob.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const statusLabel = {
    CONFIRMED: "Chờ khám",
    CHECKED_IN: "Đã tiếp nhận",
    IN_PROGRESS: "Đang khám",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    NO_SHOW: "Vắng mặt",
  }[appointment.status] || appointment.status;

  const statusDotColor = {
    CONFIRMED: "bg-blue-500",
    CHECKED_IN: "bg-amber-500",
    IN_PROGRESS: "bg-purple-500",
    COMPLETED: "bg-emerald-500",
    CANCELLED: "bg-red-500",
    NO_SHOW: "bg-gray-500",
  }[appointment.status] || "bg-gray-500";

  // Determine appointment type label
  const isWalkIn = appointment.walk_in === true;
  const appointmentTypeLabel = isWalkIn ? "Khám không hẹn" : "Khám có hẹn";

  // Check if can check-in (only for CONFIRMED status)
  const canCheckIn = appointment.status === "CONFIRMED";
  const canReschedule = appointment.status === "CONFIRMED";
  const canCancelAppt = appointment.status === "CONFIRMED" || appointment.status === "CHECKED_IN";

  return (
    <div className="space-y-4">
      {/* Patient Info Card */}
      <div className="bg-background rounded-xl border p-5">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-2xl font-bold text-primary">
            {(appointment.patient_name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-foreground">{appointment.patient_name ?? "Bệnh nhân"}</h3>
            {age != null && <p className="text-sm text-muted-foreground">{age} tuổi</p>}
            {dobFormatted && <p className="text-sm text-muted-foreground">Ngày sinh: {dobFormatted}</p>}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {appointment.patient_phone && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.patient_phone}</span>
            </div>
          )}
          {appointment.specialty_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              <span>{appointment.specialty_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold uppercase mb-2">
            <Clock className="h-4 w-4" />
            Giờ hẹn
          </div>
          {isWalkIn ? (
            <p className="text-lg font-bold text-blue-700">Khám không hẹn</p>
          ) : appointmentTime && appointmentDate ? (
            <>
              <p className="text-2xl font-bold text-blue-700">{appointmentTime}</p>
              <p className="text-sm text-blue-600">{appointmentDate}</p>
            </>
          ) : appointmentDate ? (
            <p className="text-lg font-bold text-blue-700">{appointmentDate}</p>
          ) : (
            <p className="text-lg font-bold text-blue-700">—</p>
          )}
        </div>

        <div className="bg-background rounded-xl border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2">
            <CalendarDays className="h-4 w-4" />
            Bác sĩ
          </div>
          <p className="text-lg font-bold text-foreground">{appointment.doctor_name || "—"}</p>
        </div>
      </div>

      {/* Status & Appointment Type */}
      <div className="bg-background rounded-xl border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotColor}`} />
          <span className="text-sm font-medium text-foreground">{statusLabel}</span>
          <span className="text-sm text-muted-foreground">{appointmentTypeLabel}</span>
        </div>
        <span className="text-sm text-muted-foreground font-mono">{patientCode}</span>
      </div>

      {/* Reason for Visit */}
      {appointment.reason && (
        <div className="bg-background rounded-xl border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2">
            <FileText className="h-4 w-4" />
            Lý do khám
          </div>
          <p className="text-sm text-foreground italic">"{appointment.reason}"</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Sinh hiệu ────────────────────────────────────────────────────────────
function VitalSignsTab({
  appointment,
  history,
  isLoading,
  initialValues,
  onFormChange,
}: {
  appointment: AdminAppointment;
  history: VitalSignsRow[];
  isLoading: boolean;
  initialValues?: Record<string, string>;
  onFormChange: (data: Record<string, string>, hasError: boolean) => void;
}) {
  return (
    <div>
      {/* History */}
      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse mb-4">Đang tải lịch sử…</p>
      )}

      {history.length > 0 && (
        <section className="space-y-3 mb-6">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lịch sử đo ({history.length} lần)
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {history.map((v) => (
              <HistoryCard key={v.id} v={v} />
            ))}
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Form bên dưới sẽ <strong>thêm bản ghi mới</strong> (đã điền sẵn giá trị lần trước).
          </p>
        </section>
      )}

      {/* Form */}
      <VitalSignsFormContent
        key={appointment.id}
        appointmentId={appointment.id}
        initialValues={initialValues}
        onChange={onFormChange}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VitalSignsSheet({
  appointment,
  onClose,
  onCheckIn,
  onReschedule,
  onCancelAppointment,
  onViewPatientRecords,
  onRefresh,
}: VitalSignsSheetProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("info");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasBlockingError, setHasBlockingError] = useState(false);

  const [patientRecordDialogOpen, setPatientRecordDialogOpen] = useState(false);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["vital_signs", appointment?.id],
    queryFn: () =>
      listVitalSignsByAppointment(supabase, appointment!.id).then((r) => r.vitals),
    enabled: Boolean(appointment?.id),
    staleTime: 0,
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("No appointment");
      const input: RecordVitalSignsInput = {
        appointment_id:   appointment.id,
        bp_systolic:      parseNum(formData.bp_systolic || ""),
        bp_diastolic:     parseNum(formData.bp_diastolic || ""),
        heart_rate:       parseNum(formData.heart_rate || ""),
        temperature_c:    parseNum(formData.temperature_c || ""),
        respiratory_rate: parseNum(formData.respiratory_rate || ""),
        spo2:             parseNum(formData.spo2 || ""),
        weight_kg:        parseNum(formData.weight_kg || ""),
        height_cm:        parseNum(formData.height_cm || ""),
        clinical_note:    (formData.clinical_note || "").trim() || null,
      };
      const { result, error } = await recordVitalSigns(supabase, input);
      if (error) throw error;
      return result!;
    },
    onSuccess: (result) => {
      if (result.is_critical) {
        toast.error("⚠ Sinh hiệu nguy kịch — Thông báo đến Bác sĩ ngay!", {
          duration: 8000,
          description: result.critical_flags.join(" · "),
        });
      } else {
        toast.success("Đã lưu sinh hiệu thành công");
      }
      void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["vital_signs", appointment?.id] });
      onRefresh?.();
    },
    onError: (err: Error) => {
      if (err.message.includes("INVALID_WEIGHT")) {
        toast.error("Cân nặng phải > 0");
      } else if (err.message.includes("INVALID_HEIGHT")) {
        toast.error("Chiều cao phải > 0");
      } else if (err.message.includes("numeric field overflow") || err.message.includes("22003")) {
        toast.error("Giá trị vượt quá giới hạn cho phép — kiểm tra lại cân nặng và chiều cao");
      } else {
        toast.error(`Lưu thất bại: ${err.message}`);
      }
    },
  });

  const handleFormChange = useCallback((data: Record<string, string>, hasError: boolean) => {
    setFormData(data);
    setHasBlockingError(hasError);
  }, []);

  if (!appointment) return null;

  const patientCode = `BN-${appointment.profile_id.slice(0, 8).toUpperCase()}`;
  const latest = history[0] ?? null;

  // Safe date parsing for header
  const headerStartTime = appointment.start_time ? new Date(appointment.start_time) : null;
  const headerIsValidDate = headerStartTime && !isNaN(headerStartTime.getTime());
  const headerAppointmentDate = headerIsValidDate
    ? headerStartTime.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const headerAppointmentTime = headerIsValidDate
    ? headerStartTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Pre-populate form with the latest recorded values
  const initialValues = latest
    ? {
        bp_systolic:      toStr(latest.bp_systolic),
        bp_diastolic:     toStr(latest.bp_diastolic),
        heart_rate:       toStr(latest.heart_rate),
        temperature_c:    toStr(latest.temperature_c),
        respiratory_rate: toStr(latest.respiratory_rate),
        spo2:             toStr(latest.spo2),
        weight_kg:        toStr(latest.weight_kg),
        height_cm:        toStr(latest.height_cm),
        clinical_note:    latest.clinical_note ?? "",
      }
    : undefined;

  return (
    <Dialog open={Boolean(appointment)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-5xl h-[90vh] max-h-[900px] flex flex-col gap-0 p-0 overflow-hidden rounded-xl"
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <DialogHeader className="flex flex-row items-center gap-4 border-b px-6 py-4 shrink-0 bg-muted/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-lg font-bold text-primary">
              Sinh hiệu – {appointment.patient_name ?? "Bệnh nhân"}
            </DialogTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>Mã bệnh nhân: {patientCode}</span>
              {headerAppointmentDate && headerAppointmentTime && (
                <>
                  <span className="text-border">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {headerAppointmentDate} • {headerAppointmentTime}
                  </span>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 shrink-0 bg-background border-b">
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 bg-muted/50 gap-1 sm:gap-0 p-1 sm:p-1">
              <TabsTrigger
                value="info"
                className="gap-2 text-sm h-10 sm:h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                <User className="h-4 w-4" />
                Thông tin
              </TabsTrigger>
              <TabsTrigger
                value="pre-visit"
                className="gap-2 text-sm h-10 sm:h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                <FileText className="h-4 w-4" />
                Khai báo trước khám
              </TabsTrigger>
              <TabsTrigger
                value="vital-signs"
                className="gap-2 text-sm h-10 sm:h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                <Activity className="h-4 w-4" />
                Sinh hiệu
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 bg-muted/20">
            <TabsContent value="info" className="mt-0 h-full">
              <InfoTab
                appointment={appointment}
                onCheckIn={onCheckIn ? () => onCheckIn(appointment) : undefined}
                onReschedule={onReschedule ? () => onReschedule(appointment) : undefined}
                onCancel={onCancelAppointment ? () => onCancelAppointment(appointment) : undefined}
                onViewPatientRecords={onViewPatientRecords ? () => onViewPatientRecords(appointment) : undefined}
              />
            </TabsContent>

            <TabsContent value="pre-visit" className="mt-0 h-full">
              <PreConsultationDualView
                appointmentId={appointment.id}
                appointmentStatus={appointment.status}
                onSaved={onRefresh}
              />
            </TabsContent>

            <TabsContent value="vital-signs" className="mt-0 h-full">
              <VitalSignsTab
                appointment={appointment}
                history={history}
                isLoading={isLoading}
                initialValues={initialValues}
                onFormChange={handleFormChange}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {activeTab === "info" && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t bg-background">
            {/* View Patient Records */}
            <button
              type="button"
              onClick={() => setPatientRecordDialogOpen(true)}
              className="flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <ClipboardList className="h-4 w-4" />
              Xem hồ sơ
            </button>

            {/* Reschedule */}
            {appointment.status === "CONFIRMED" && (
              <button
                type="button"
                onClick={onReschedule ? () => onReschedule(appointment) : undefined}
                className="flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                Đổi lịch
              </button>
            )}

            {/* Cancel */}
            {/* Cancel */}
            {(appointment.status === "CONFIRMED" || appointment.status === "CHECKED_IN") && (
              <button
                type="button"
                onClick={onCancelAppointment ? () => onCancelAppointment(appointment) : undefined}
                className="flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Hủy lịch
              </button>
            )}

            {/* Check-in Button */}
            {appointment.status === "CONFIRMED" && (
              <Button
                className="h-10 px-6 text-sm font-semibold rounded-lg gap-2"
                onClick={onCheckIn ? () => onCheckIn(appointment) : undefined}
              >
                <CalendarDays className="h-4 w-4" />
                Tiếp nhận
              </Button>
            )}
          </div>
        )}

        {activeTab === "vital-signs" && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t bg-background">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-12 px-8 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              Hủy bỏ
            </button>
            <Button
              className="h-12 px-8 text-sm font-semibold rounded-lg gap-2 min-w-[120px]"
              onClick={() => submit()}
              disabled={isPending || hasBlockingError}
            >
              <Save className="h-4 w-4" />
              {isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Patient Record Dialog */}
      {appointment?.profile_id && (
        <PatientRecordDialog
          open={patientRecordDialogOpen}
          onClose={() => setPatientRecordDialogOpen(false)}
          profileId={appointment.profile_id}
          nested
        />
      )}
    </Dialog>
  );
}
