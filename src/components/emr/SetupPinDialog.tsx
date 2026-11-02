/**
 * FR-011: Setup PIN dialog
 * First-time doctor PIN setup before they can sign examinations
 */

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type SetupPinDialogProps = {
  open: boolean;
  onClose: () => void;
  onSetup: (pin: string) => Promise<boolean>;
};

export default function SetupPinDialog({ open, onClose, onSetup }: SetupPinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState('');

  const isValid = pin.length === 6 && confirmPin.length === 6;

  const handleSetup = async () => {
    setError('');
    if (pin !== confirmPin) {
      setError('Hai mã PIN không khớp nhau.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Mã PIN phải gồm đúng 6 chữ số.');
      return;
    }

    setSetting(true);
    try {
      const ok = await onSetup(pin);
      if (ok) {
        setPin('');
        setConfirmPin('');
      }
    } finally {
      setSetting(false);
    }
  };

  const handleClose = () => {
    if (setting) return;
    setPin('');
    setConfirmPin('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Thiết lập mã PIN ký duyệt
          </DialogTitle>
          <DialogDescription>
            Mã PIN 6 chữ số dùng để xác nhận danh tính khi ký duyệt hồ sơ bệnh nhân.
            Giữ bí mật mã này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">Mã PIN mới (6 chữ số)</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="text-center text-xl tracking-[0.5em] font-mono h-12"
              disabled={setting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Xác nhận mã PIN</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="text-center text-xl tracking-[0.5em] font-mono h-12"
              disabled={setting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) void handleSetup();
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={setting}>
            Hủy
          </Button>
          <Button onClick={() => void handleSetup()} disabled={!isValid || setting}>
            {setting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Đang lưu...</>
              : 'Thiết lập PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
