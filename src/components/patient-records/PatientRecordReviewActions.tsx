import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewPatientProfile } from "@/lib/patient-records";
import { supabase } from "@/lib/supabase";
import type { PatientProfileStatus } from "@/types/patient-portal";

type PatientRecordReviewActionsProps = {
  patientId: string;
  status: PatientProfileStatus;
  canReview?: boolean;
  disabled?: boolean;
  onSuccess: () => void;
};

const PatientRecordReviewActions = ({
  patientId,
  status,
  canReview = false,
  disabled = false,
  onSuccess,
}: PatientRecordReviewActionsProps) => {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canReview || status !== "UNVERIFIED") return null;

  const runReview = async (action: "approve" | "reject") => {
    const trimmed = reason.trim();
    if (action === "reject" && !trimmed) {
      toast.error("Vui lòng nhập lý do từ chối.");
      return;
    }
    setBusy(true);
    const { error } = await reviewPatientProfile(
      supabase,
      patientId,
      action,
      action === "reject" ? trimmed : null,
    );
    setBusy(false);
    if (error) {
      toast.error(action === "approve" ? "Phê duyệt thất bại" : "Từ chối thất bại", {
        description: error.message,
      });
      return;
    }
    toast.success(action === "approve" ? "Đã phê duyệt hồ sơ" : "Đã từ chối hồ sơ");
    setApproveOpen(false);
    setRejectOpen(false);
    setReason("");
    onSuccess();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={disabled || busy}
          onClick={() => setApproveOpen(true)}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Phê duyệt
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={disabled || busy}
          onClick={() => {
            setReason("");
            setRejectOpen(true);
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Từ chối
        </Button>
      </div>

      <AlertDialog open={approveOpen} onOpenChange={(open) => { if (!busy) setApproveOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phê duyệt hồ sơ?</AlertDialogTitle>
            <AlertDialogDescription>
              Hồ sơ sẽ chuyển sang trạng thái Đang hoạt động. Bệnh nhân có thể đặt lịch khám.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <Button type="button" disabled={busy} onClick={() => void runReview("approve")}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Phê duyệt
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={(open) => { if (!busy) setRejectOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ chối hồ sơ?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhập lý do từ chối. Hồ sơ sẽ chuyển sang trạng thái Đã từ chối.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Lý do từ chối</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Ảnh CCCD bị mờ, không đối chiếu được số"
              disabled={busy}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() => void runReview("reject")}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Từ chối
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PatientRecordReviewActions;
