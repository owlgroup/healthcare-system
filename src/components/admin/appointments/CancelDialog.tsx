import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WALK_IN_LABEL } from "@/types/admin-appointment";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminCancelAppointment } from "@/lib/admin-appointment-api";
import type { AdminAppointment } from "@/types/admin-appointment";

interface Props {
  appointment: AdminAppointment;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nested?: boolean;
}

export default function CancelDialog({ appointment, open, onClose, onSuccess, nested = false }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Lý do hủy phải ít nhất 5 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const { emailSent, emailError } = await adminCancelAppointment(appointment.id, reason.trim());
      if (emailSent) {
        toast.success("Đã hủy lịch hẹn. Email thông báo đã được gửi cho bệnh nhân.");
      } else {
        toast.warning("Đã hủy lịch hẹn, nhưng gửi email thất bại.", {
          description: emailError ?? "Không thể kết nối dịch vụ email.",
        });
      }
      setReason("");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy lịch thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" hideOverlay={nested}>
        <DialogHeader>
          <DialogTitle>Hủy lịch hẹn</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <p className="font-medium">{appointment.patient_name || "—"}</p>
            <p className="text-muted-foreground">
              {appointment.slot_date
                ? `${appointment.start_time?.slice(0, 5)} · ${appointment.slot_date}`
                : WALK_IN_LABEL + " · " + new Date(appointment.created_at).toLocaleDateString("vi-VN")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Lý do hủy <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="Nhập lý do hủy (tối thiểu 5 ký tự)…"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/5 ký tự tối thiểu
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || reason.trim().length < 5}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
