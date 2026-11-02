import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminBulkCancel } from "@/lib/admin-appointment-api";

interface Props {
  appointmentIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (cancelled: number) => void;
}

export default function BulkCancelDialog({ appointmentIds, open, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const n = appointmentIds.length;

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Lý do hủy phải ít nhất 5 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const { count, emailsSent } = await adminBulkCancel(appointmentIds, reason.trim());
      toast.success(`Đã hủy ${count} lịch hẹn. Đã gửi ${emailsSent}/${count} email thông báo.`);
      setReason("");
      onSuccess(count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy hàng loạt thất bại.");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hủy hàng loạt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              Đồng ý hủy <strong>{n}</strong> lịch hẹn đã chọn?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-reason">
              Lý do hủy chung <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="bulk-reason"
              placeholder="VD: Bác sĩ nghỉ đột xuất ngày…"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{reason.length}/5 ký tự tối thiểu</p>
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
            Hủy {n} lịch hẹn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
