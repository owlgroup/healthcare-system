import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CccdBhytCompareResult } from "@/lib/cccd-bhyt-cross-validate";

type Props = {
  result: CccdBhytCompareResult;
  confirmed: boolean;
  onConfirm: () => void;
  onReupload?: () => void;
};

function dash(value: string): string {
  return value.trim() || "—";
}

export default function CccdBhytMismatchBanner({
  result,
  confirmed,
  onConfirm,
  onReupload,
}: Props) {
  if (!result.hasMismatch) return null;

  const pct = Math.round(result.nameMismatchRatio * 100);
  const fieldNotes = [
    result.nameMismatch ? `Họ tên lệch ${pct}%` : null,
    result.dobMismatch ? "Ngày sinh không khớp" : null,
  ].filter(Boolean);

  return (
    <Alert variant="destructive" className="mt-5" role="alert">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>CCCD và thẻ BHYT không khớp.</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          CCCD: {dash(result.cccdName)} · {dash(result.cccdDob)}
          {" — "}
          BHYT: {dash(result.bhytName)} · {dash(result.bhytDob)}
        </p>
        {fieldNotes.length > 0 ? (
          <p>{fieldNotes.join(". ")}.</p>
        ) : null}
        <p>Vui lòng tải lại giấy tờ hoặc xác nhận để tiếp tục.</p>
        {confirmed ? (
          <p className="text-xs font-semibold">Bạn đã xác nhận tiếp tục với thông tin khác nhau.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={onConfirm}>
              Xác nhận thông tin khác nhau
            </Button>
            {onReupload ? (
              <Button type="button" size="sm" variant="outline" onClick={onReupload}>
                Tải lại giấy tờ
              </Button>
            ) : null}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
