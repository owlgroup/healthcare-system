/**
 * TC-DLS-016: Addendum Sign-off Dialog
 * Shows addendum summary, checkbox for responsibility, PIN input
 */

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Lock, Loader2, Shield } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { MedicalExamination } from '@/types/emr';
import { isPinSignLockMessage, PIN_SIGN_LOCK_MESSAGE } from '@/types/emr';

type AddendumSignOffDialogProps = {
  open: boolean;
  onClose: () => void;
  onSign: (pin: string, ack: boolean) => Promise<string | null>;
  addendum?: MedicalExamination | null;
  pendingContent?: { reason: string; content: string } | null;
  pinLocked?: boolean;
};

export default function AddendumSignOffDialog({
  open, onClose, onSign, addendum, pendingContent, pinLocked = false,
}: AddendumSignOffDialogProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [ack, setAck] = useState(false);
  const [signing, setSigning] = useState(false);
  const [pinError, setPinError] = useState('');
  const [lockedByAttempt, setLockedByAttempt] = useState(false);

  const isLocked = pinLocked || lockedByAttempt;

  useEffect(() => {
    if (open) {
      setPin('');
      setShowPin(false);
      setAck(false);
      setLockedByAttempt(false);
      setPinError(pinLocked ? PIN_SIGN_LOCK_MESSAGE : '');
    }
  }, [open, pinLocked]);

  const canSign = ack && pin.length === 6 && !isLocked;

  const handleSign = async () => {
    if (!canSign) return;
    setPinError('');
    setSigning(true);
    try {
      const error = await onSign(pin, ack);
      if (!error) {
        setPin('');
        setShowPin(false);
        setAck(false);
        return;
      }
      setPinError(error);
      if (isPinSignLockMessage(error)) {
        setLockedByAttempt(true);
      }
    } catch {
      // errors shown by toast in parent
    } finally {
      setSigning(false);
    }
  };

  const handleClose = () => {
    if (signing) return;
    setPin('');
    setShowPin(false);
    setAck(false);
    setPinError('');
    setLockedByAttempt(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Ký xác nhận phiếu bổ sung
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Nội dung phiếu bổ sung
            </p>
            {(pendingContent?.reason || addendum?.amendment_reason) && (
              <div>
                <span className="font-bold text-primary text-xs">Lý do:</span>{' '}
                <span className="text-xs">{pendingContent?.reason || addendum?.amendment_reason}</span>
              </div>
            )}
            {(pendingContent?.content || addendum?.s_text) && (
              <div>
                <span className="font-bold text-primary text-xs">Nội dung:</span>{' '}
                <span className="text-xs line-clamp-3">{pendingContent?.content || addendum?.s_text}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="h-4 w-4" />
            <span>Phiếu bổ sung sẽ được đính kèm vĩnh viễn vào hồ sơ gốc</span>
          </div>

          <Separator />

          {isLocked && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {PIN_SIGN_LOCK_MESSAGE}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="responsibility-addendum"
              checked={ack}
              onCheckedChange={(c) => setAck(Boolean(c))}
              disabled={signing || isLocked}
            />
            <Label htmlFor="responsibility-addendum" className="text-sm leading-relaxed cursor-pointer">
              Tôi xác nhận nội dung phiếu bổ sung này là chính xác và chịu trách nhiệm về thông tin
              đã bổ sung. Tôi hiểu rằng sau khi ký, phiếu bổ sung sẽ được khóa và không thể chỉnh sửa.
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-pin-addendum" className="text-sm font-medium">
              Mã PIN ký duyệt (6 chữ số)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="sign-pin-addendum"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPin(val);
                  if (!isLocked) setPinError('');
                }}
                placeholder="******"
                className="text-center text-xl tracking-[0.5em] font-mono h-12 flex-1"
                disabled={signing || isLocked}
                autoComplete="off"
                aria-describedby="sign-pin-addendum-hint"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSign) void handleSign();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                disabled={signing || isLocked}
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p id="sign-pin-addendum-hint" className="text-xs text-muted-foreground">
              Nhập đủ 6 chữ số PIN để ký xác nhận phiếu bổ sung.
            </p>
            {pinError && !isLocked && <p className="text-xs text-destructive">{pinError}</p>}
            {pinError && isLocked && pinError !== PIN_SIGN_LOCK_MESSAGE && (
              <p className="text-xs text-destructive">{pinError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={signing}>
            Hủy
          </Button>
          <Button
            onClick={() => void handleSign()}
            disabled={!canSign || signing}
            className="gap-1.5"
          >
            {signing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Đang ký...</>
            ) : (
              <><Lock className="h-4 w-4" />Ký xác nhận</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
