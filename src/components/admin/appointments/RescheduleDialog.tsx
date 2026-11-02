import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WALK_IN_LABEL } from "@/types/admin-appointment";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchSlots } from "@/lib/appointment-api";
import { adminRescheduleAppointment } from "@/lib/admin-appointment-api";
import type { AdminAppointment } from "@/types/admin-appointment";
import type { AppointmentSlot } from "@/types/appointment";

interface Props {
  appointment: AdminAppointment;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nested?: boolean;
}

export default function RescheduleDialog({ appointment, open, onClose, onSuccess, nested = false }: Props) {
  const [date, setDate] = useState<Date | undefined>(
    appointment.slot_date ? new Date(appointment.slot_date) : new Date()
  );
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [loading, setLoading] = useState(false);

  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  const { data: slots = [], isFetching } = useQuery({
    queryKey: ["admin-slots", appointment.specialty_id, dateStr],
    queryFn: () => fetchSlots(appointment.specialty_id, dateStr),
    enabled: !!dateStr && open,
  });

  const available = slots.filter((s) => s.is_available);

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      await adminRescheduleAppointment(appointment.id, selectedSlot.id);
      toast.success("Đã đổi lịch hẹn thành công.");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đổi lịch thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelectedSlot(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" hideOverlay={nested}>
        <DialogHeader>
          <DialogTitle>Đổi lịch hẹn</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <p className="font-medium">{appointment.patient_name || "—"}</p>
            <p className="text-muted-foreground">
              Hiện tại:{" "}
              {appointment.slot_date
                ? `${appointment.start_time?.slice(0, 5)} · ${appointment.slot_date}`
                : WALK_IN_LABEL}
            </p>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Chọn ngày mới</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: vi }) : "Chọn ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setSelectedSlot(null); }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Slot picker */}
          {date && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Chọn giờ khám</p>
              {isFetching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
                </div>
              ) : available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Không có slot trống trong ngày này.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {available.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-lg border py-2 text-sm font-medium transition-colors",
                        selectedSlot?.id === slot.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      )}
                    >
                      {slot.start_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Đóng
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedSlot}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận đổi lịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
