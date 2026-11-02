import { useEffect, useState } from "react";
import { format, differenceInYears, parseISO } from "date-fns";
import { Clock, Stethoscope, Phone, CalendarCheck, X, FileUser, UserRoundPlus, ClipboardList, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CancelDialog from "./CancelDialog";
import RescheduleDialog from "./RescheduleDialog";
import PatientRecordDialog from "./PatientRecordDialog";
import AdminCreateProfileDialog from "./AdminCreateProfileDialog";
import PreConsultationDualView from "@/components/pre-consultation/PreConsultationDualView";
import type { AdminAppointment } from "@/types/admin-appointment";
import {
  ADMIN_STATUS_LABEL, ADMIN_STATUS_DOT,
} from "@/types/admin-appointment";
import { adminCheckinAppointment } from "@/lib/admin-appointment-api";
import {
  getAppointmentReadiness,
  getAppointmentReadinessMessage,
} from "@/lib/appointment-readiness";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { UI_WALK_IN, UI_CHECK_IN } from "@/config/ui-labels";

interface Props {
  appointment: AdminAppointment | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AppointmentDetailSheet({ appointment, open, onClose, onRefresh }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createProfileOpen, setCreateProfileOpen] = useState(false);
  // null = still checking, true/false = has uploaded ID documents
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "preconsult">("info");

  useEffect(() => {
    if (!open || !appointment?.profile_id) { setHasProfile(null); return; }
    setHasProfile(null);
    supabase
      .from("patient")
      .select("id, id_document_storage_path")
      .eq("id", appointment.profile_id)
      .maybeSingle()
      .then(({ data }) => setHasProfile(Boolean(data?.id_document_storage_path)));
  }, [open, appointment?.profile_id]);

  if (!appointment) return null;

  const initials = appointment.patient_name
    ? appointment.patient_name.trim().split(" ").pop()?.charAt(0).toUpperCase() ?? "?"
    : "?";

  const age = appointment.patient_dob
    ? differenceInYears(new Date(), parseISO(appointment.patient_dob))
    : null;

  const shortId = appointment.id.slice(0, 6).toUpperCase();

  const canCheckin = appointment.status === "CONFIRMED";
  const canCancel  = !["CANCELLED", "COMPLETED"].includes(appointment.status);
  const canReschedule = ["CONFIRMED", "CHECKED_IN"].includes(appointment.status) && !appointment.walk_in;

  const handleCheckin = async () => {
    const readiness = getAppointmentReadiness(appointment);
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

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <SheetContent
          className={`w-full overflow-y-auto ${
            activeTab === 'preconsult' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
          }`}
        >
          <SheetHeader className="mb-4">
            <SheetTitle>Chi tiết lịch hẹn</SheetTitle>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "preconsult")}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="info" className="flex-1">
                <Stethoscope className="h-4 w-4 mr-2" />
                Thông tin
              </TabsTrigger>
              <TabsTrigger value="preconsult" className="flex-1">
                <ClipboardList className="h-4 w-4 mr-2" />
                Khai báo trước khám
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info">
              {/* Patient card */}
              <div className="rounded-2xl bg-card border p-5 mb-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-lg leading-tight">{appointment.patient_name || "—"}</p>
                    {age !== null && (
                      <p className="text-sm text-muted-foreground">{age} tuổi</p>
                    )}
                  </div>
                </div>

                {appointment.patient_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {appointment.patient_phone}
                  </div>
                )}

                {appointment.specialty_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Stethoscope className="h-4 w-4" />
                    {appointment.specialty_name}
                  </div>
                )}
              </div>

              {/* Time + Doctor cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-2xl bg-cyan-50 border border-cyan-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-cyan-600" />
                    <span className="text-xs font-medium text-cyan-700 uppercase tracking-wide">Giờ hẹn</span>
                  </div>
                  <p className="text-lg font-bold text-cyan-900">
                    {appointment.slot_date && appointment.start_time
                      ? appointment.start_time.slice(0, 5)
                      : UI_WALK_IN}
                  </p>
                  {appointment.slot_date && (
                    <p className="text-xs text-cyan-700 mt-0.5">
                      {format(parseISO(appointment.slot_date), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarCheck className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 uppercase tracking-wide">Bác sĩ</span>
                  </div>
                  <p className="text-sm font-bold text-purple-900 leading-tight">
                    {appointment.doctor_name || "—"}
                  </p>
                </div>
              </div>

              {/* Reason */}
              {appointment.note && (
                <div className="rounded-2xl bg-muted/50 border p-4 mb-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lý do khám</p>
                  <p className="text-sm italic">"{appointment.note}"</p>
                </div>
              )}

              {/* Status + walk-in badge */}
              <div className="flex items-center justify-between rounded-2xl bg-muted/30 border px-4 py-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${ADMIN_STATUS_DOT[appointment.status]}`} />
                  <span className="text-sm font-medium">{ADMIN_STATUS_LABEL[appointment.status]}</span>
                  {appointment.walk_in && (
                    <Badge variant="secondary" className="text-xs">{UI_WALK_IN}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">#{shortId}</span>
              </div>

              {/* Cancel reason if cancelled */}
              {appointment.status === "CANCELLED" && appointment.cancel_reason && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 mb-6 flex gap-3">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-destructive mb-0.5">Lý do hủy</p>
                    <p className="text-sm text-destructive/80">{appointment.cancel_reason}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {hasProfile === false ? (
                  <Button variant="outline" className="w-full" onClick={() => setCreateProfileOpen(true)}>
                    <UserRoundPlus className="mr-2 h-4 w-4" />
                    Tạo hồ sơ bệnh nhân
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setProfileOpen(true)}>
                    <FileUser className="mr-2 h-4 w-4" />
                    Xem hồ sơ bệnh nhân
                  </Button>
                )}

                {canCheckin && (
                  <Button
                    className="w-full"
                    onClick={handleCheckin}
                    disabled={checkingIn || hasProfile === false || hasProfile === null}
                    title={hasProfile === false ? "Bệnh nhân chưa có hồ sơ" : undefined}
                  >
                    {checkingIn
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <CalendarCheck className="mr-2 h-4 w-4" />
                    }
                    {UI_CHECK_IN} ngay
                    {hasProfile === null && <Loader2 className="ml-2 h-3 w-3 animate-spin opacity-60" />}
                  </Button>
                )}

                {canReschedule && (
                  <Button variant="outline" className="w-full" onClick={() => setRescheduleOpen(true)}>
                    Đổi lịch
                  </Button>
                )}

                {canCancel && (
                  <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setCancelOpen(true)}>
                    Hủy lịch hẹn
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Pre-consultation Tab */}
            <TabsContent value="preconsult">
              <PreConsultationDualView
                appointmentId={appointment.id}
                appointmentStatus={appointment.status}
                onSaved={onRefresh}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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
