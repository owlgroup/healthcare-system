import { FormEvent, useEffect, useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type OtpStepProps = {
  email: string;
  otp: string;
  isSubmitting: boolean;
  errorMessage: string;
  lockSeconds: number;
  resendCooldown: number;
  otpExpiresAt: number | null;
  attemptsLeft: number | null;
  onOtpChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onResend: () => void;
};

const formatMmSs = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const OtpStep = ({
  email,
  otp,
  isSubmitting,
  errorMessage,
  lockSeconds,
  resendCooldown,
  otpExpiresAt,
  attemptsLeft,
  onOtpChange,
  onSubmit,
  onBack,
  onResend,
}: OtpStepProps) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!otpExpiresAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [otpExpiresAt]);
  void tick;

  const otpSecondsLeft = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000))
    : 0;

  return (
    <form onSubmit={onSubmit}>
      <p className="mb-4 text-sm text-muted-foreground">
        Mã đã gửi tới <span className="font-medium text-foreground">{email}</span>
      </p>

      {otpExpiresAt && otpSecondsLeft > 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          OTP hết hạn sau: {formatMmSs(otpSecondsLeft)}
        </p>
      ) : otpExpiresAt ? (
        <p className="mb-3 text-xs text-amber-600">OTP đã hết hạn — gửi lại mã mới.</p>
      ) : null}

      <div className="mb-6 flex justify-center">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={onOtpChange}
          disabled={isSubmitting || lockSeconds > 0}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {errorMessage ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {errorMessage}
          {attemptsLeft != null && attemptsLeft > 0
            ? ` (Còn ${attemptsLeft} lần thử)`
            : null}
        </p>
      ) : null}

      {lockSeconds > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Xác minh tạm khóa. Thử lại sau {lockSeconds}s.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || otp.length !== 6 || lockSeconds > 0}
        className="mb-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Đang xác minh..." : "Xác minh OTP"}
      </button>

      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          Đổi email
        </button>
        <button
          type="button"
          disabled={
            resendCooldown > 0 || isSubmitting || lockSeconds > 0
          }
          onClick={onResend}
          className="font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {resendCooldown > 0
            ? `Gửi lại sau ${resendCooldown}s`
            : "Gửi lại OTP"}
        </button>
      </div>
    </form>
  );
};

export default OtpStep;
