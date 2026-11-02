// FR-021: Check-in button shown on today's CONFIRMED appointment cards.
// Calls performCheckin RPC and shows CheckinSuccessSheet on success.

import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { performCheckin } from '@/lib/queue-api';
import { mapQueueError } from '@/types/queue';
import type { CheckinResult } from '@/types/queue';
import CheckinSuccessSheet from './CheckinSuccessSheet';

interface CheckinButtonProps {
  appointmentId: string;
  slotDate: string;        // YYYY-MM-DD
  status: string;
  onCheckedIn?: () => void;
}

export default function CheckinButton({
  appointmentId,
  slotDate,
  status,
  onCheckedIn,
}: CheckinButtonProps) {
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<CheckinResult | null>(null);
  const [sheetOpen, setSheetOpen]     = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const isToday = slotDate === today;

  // Only show for today's CONFIRMED appointments
  if (!isToday || status !== 'CONFIRMED') return null;

  async function handleCheckin() {
    setLoading(true);
    try {
      const data = await performCheckin(appointmentId);
      setResult(data);
      setSheetOpen(true);
      onCheckedIn?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(mapQueueError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={handleCheckin}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <QrCode className="h-4 w-4" />
        )}
        {loading ? 'Đang xử lý...' : 'Tiếp nhận'}
      </Button>

      <CheckinSuccessSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        result={result}
      />
    </>
  );
}
