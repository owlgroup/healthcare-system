import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DupCheckResult } from "@/lib/duplicate-check";

type Props = {
  result: DupCheckResult;
  onBypass: (reason: string) => void;
  onCancel: () => void;
};

export default function DuplicatePatientAlert({ result, onBypass, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const hasHardBlock = Boolean(result.cccdMatchId);
  const hasWarning = Boolean(result.phoneMatchId || result.nameDobMatchId);

  if (!hasHardBlock && !hasWarning) return null;

  return (
    <Alert variant="destructive" className="my-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p className="font-semibold">Phát hiện hồ sơ có thể trùng lặp</p>
        <ul className="list-disc pl-4 text-sm space-y-1">
          {result.cccdMatchId && <li>Trùng số CCCD với hồ sơ khác (chặn cứng)</li>}
          {result.phoneMatchId && <li>Trùng số điện thoại</li>}
          {result.nameDobMatchId && <li>Trùng họ tên + ngày sinh</li>}
        </ul>

        {hasHardBlock ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>Quay lại kiểm tra</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs">Nhập lý do giải trình (tối thiểu 10 ký tự) để tiếp tục lưu:</p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Đã đối chiếu CMND, xác nhận là người thân cùng hộ..."
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={reason.trim().length < 10}
                onClick={() => onBypass(reason.trim())}
              >
                Xác nhận và tiếp tục
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>Hủy</Button>
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
