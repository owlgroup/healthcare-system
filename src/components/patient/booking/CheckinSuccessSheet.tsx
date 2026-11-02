// FR-021: Check-in success bottom sheet
// Shows the assigned queue token, room, doctor, and estimated wait time.

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, MapPin, User } from 'lucide-react';
import type { CheckinResult } from '@/types/queue';

interface CheckinSuccessSheetProps {
  open: boolean;
  onClose: () => void;
  result: CheckinResult | null;
}

export default function CheckinSuccessSheet({
  open,
  onClose,
  result,
}: CheckinSuccessSheetProps) {
  if (!result) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <SheetTitle className="text-xl">Tiếp nhận thành công!</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Vui lòng ngồi chờ và theo dõi bảng điện tử
          </p>
        </SheetHeader>

        {/* Token number — large, prominent */}
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 rounded-2xl px-10 py-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              Số thứ tự
            </p>
            <p className="text-6xl font-bold text-primary tracking-wider">
              {result.token_full}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          {result.room_name && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Phòng khám:</span>
              <span className="font-medium">{result.room_name}</span>
            </div>
          )}
          {result.doctor_name && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Bác sĩ:</span>
              <span className="font-medium">{result.doctor_name}</span>
            </div>
          )}
          {result.estimated_wait != null && (
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Thời gian chờ ước tính:</span>
              <span className="font-medium">~{result.estimated_wait} phút</span>
            </div>
          )}
          {!result.room_name && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
              Phòng khám đang được xếp. Vui lòng chờ thông báo từ lễ tân.
            </p>
          )}
        </div>

        <Button className="w-full" onClick={onClose}>
          Đã hiểu
        </Button>
      </SheetContent>
    </Sheet>
  );
}
