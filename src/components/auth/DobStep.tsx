import { type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Calendar, Loader2 } from "lucide-react";

type DobStepProps = {
  dateOfBirth: string;
  isSubmitting: boolean;
  errorMessage: string;
  fieldError: string;
  lockSeconds: number;
  dobExpiresAt: number | null;
  attemptsLeft: number | null;
  onDateOfBirthChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
};

const formatMmSs = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30";
const fieldErrorClass = "border-destructive ring-1 ring-destructive/30";

const DobStep = ({
  dateOfBirth,
  isSubmitting,
  errorMessage,
  fieldError,
  lockSeconds,
  dobExpiresAt,
  attemptsLeft,
  onDateOfBirthChange,
  onSubmit,
  onBack,
}: DobStepProps) => {
  const dobSecondsLeft = dobExpiresAt
    ? Math.max(0, Math.ceil((dobExpiresAt - Date.now()) / 1000))
    : 0;

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="mb-4 text-sm text-muted-foreground">
        Nhập ngày sinh đã đăng ký trong hồ sơ để hoàn tất đăng nhập.
      </p>

      {dobExpiresAt && dobSecondsLeft > 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Phiên xác thực hết hạn sau: {formatMmSs(dobSecondsLeft)}
        </p>
      ) : dobExpiresAt ? (
        <p className="mb-3 text-xs text-amber-600">Phiên đã hết hạn — vui lòng đăng nhập lại.</p>
      ) : null}

      <label
        htmlFor="login-dob"
        className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Ngày sinh
      </label>
      <div className="relative mb-4">
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="login-dob"
          name="dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => onDateOfBirthChange(e.target.value)}
          disabled={isSubmitting || lockSeconds > 0}
          className={`${fieldClass} pl-11 ${fieldError ? fieldErrorClass : ""}`}
          aria-invalid={Boolean(fieldError || errorMessage)}
          required
        />
      </div>

      {fieldError ? (
        <p className="mb-3 text-xs text-destructive" role="alert">
          {fieldError}
        </p>
      ) : null}

      {errorMessage ? (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
          {attemptsLeft != null && attemptsLeft > 0 && attemptsLeft < 3 ? (
            <p className="mt-1 text-xs">Còn {attemptsLeft} lần thử.</p>
          ) : null}
        </div>
      ) : null}

      {lockSeconds > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          Tạm khóa. Thử lại sau {formatMmSs(lockSeconds)}.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || lockSeconds > 0}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            Đang xác thực…
          </>
        ) : (
          "Xác nhận và đăng nhập"
        )}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className="mt-4 w-full cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        Quay lại đăng nhập
      </button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Quên ngày sinh?{" "}
        <Link to="/" className="font-medium text-primary hover:underline">
          Liên hệ hỗ trợ
        </Link>
      </p>
    </form>
  );
};

export default DobStep;
