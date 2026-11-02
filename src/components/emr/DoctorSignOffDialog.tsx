/**
 * FR-011: Doctor Sign-off Dialog
 * Shows SOAP summary, checkbox for responsibility, PIN input
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, Lock, Loader2, Shield } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { MedicalExamination, SoapIcdCode } from '@/types/emr';
import { isPinSignLockMessage, PIN_SIGN_LOCK_MESSAGE } from '@/types/emr';

type DoctorSignOffDialogProps = {
  open: boolean;
  onClose: () => void;
  onSign: (pin: string, ack: boolean) => Promise<string | null>;
  confirmedIcds: SoapIcdCode[];
  exam: MedicalExamination | null;
  pinLocked?: boolean;
};

export default function DoctorSignOffDialog({
  open, onClose, onSign, confirmedIcds, exam, pinLocked = false,
}: DoctorSignOffDialogProps) {
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

  const canSign = ack && confirmedIcds.length > 0 && pin.length === 6 && !isLocked;

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
      // errors shown by toast in hook
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
            Xác nhận & Ký duyệt hồ sơ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Tóm tắt SOAP
            </p>
            {exam?.s_text && (
              <div>
                <span className="font-bold text-primary text-xs">S:</span>{' '}
                <span className="text-xs line-clamp-2">{exam.s_text}</span>
              </div>
            )}
            {exam?.p_text && (
              <div>
                <span className="font-bold text-primary text-xs">P:</span>{' '}
                <span className="text-xs line-clamp-2">{exam.p_text}</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Chẩn đoán ({confirmedIcds.length} mã ICD đã xác nhận)
            </p>
            {confirmedIcds.length === 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Cần ít nhất 1 chẩn đoán ICD-10 đã xác nhận để ký duyệt.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {confirmedIcds.map((icd) => (
                  <span
                    key={icd.id}
                    className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-800"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {icd.icd_code} — {icd.icd_name}
                  </span>
                ))}
              </div>
            )}
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
              id="responsibility"
              checked={ack}
              onCheckedChange={(c) => setAck(Boolean(c))}
              disabled={signing || isLocked}
            />
            <Label htmlFor="responsibility" className="text-sm leading-relaxed cursor-pointer">
              Tôi đã kiểm tra và chịu trách nhiệm về nội dung hồ sơ khám này. Tôi hiểu rằng sau
              khi ký, hồ sơ sẽ được khóa và không thể chỉnh sửa trực tiếp.
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sign-pin" className="text-sm font-medium">
              Mã PIN ký duyệt (6 chữ số)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="sign-pin"
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
                aria-describedby="sign-pin-hint"
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
            <p id="sign-pin-hint" className="text-xs text-muted-foreground">
              Nhập đủ 6 chữ số PIN để ký duyệt hồ sơ.
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
              <><Lock className="h-4 w-4" />Ký duyệt hồ sơ</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
