import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Globe, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePatientDobVerification } from "@/hooks/usePatientDobVerification";
import { PatientDobError } from "@/lib/patient-dob-api";
import { isValidIsoDate } from "@/lib/patient-dob-validation";
import { consumeDobReturnTo } from "@/lib/portal-auth";

const fieldClass =
  "min-h-11 w-full rounded-xl border bg-background px-4 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30";
const fieldErrorClass = "border-destructive ring-1 ring-destructive/30";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const VerifyDob = () => {
  const navigate = useNavigate();
  const {
    isVerified,
    isLoading,
    requiresOnboarding,
    lockSeconds,
    attemptsLeft,
    verify,
    refreshStatus,
  } = usePatientDobVerification();

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (requiresOnboarding) {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (isVerified) {
      navigate(consumeDobReturnTo(), { replace: true });
    }
  }, [isLoading, isVerified, requiresOnboarding, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError("");
    setFormError("");

    if (lockSeconds > 0) {
      setFormError(`Tạm khóa. Thử lại sau ${formatCountdown(lockSeconds)}.`);
      return;
    }

    if (!dateOfBirth) {
      setFieldError("Vui lòng nhập ngày sinh");
      return;
    }

    if (!isValidIsoDate(dateOfBirth)) {
      setFieldError("Vui lòng nhập ngày sinh hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      await verify(dateOfBirth);
      toast.success("Xác thực ngày sinh thành công");
      navigate(consumeDobReturnTo(), { replace: true });
    } catch (err) {
      if (err instanceof PatientDobError) {
        if (err.code === "ONBOARDING_REQUIRED") {
          navigate("/onboarding", { replace: true });
          return;
        }
        setFormError(err.message);
        if (err.code === "DOB_LOCKED") {
          void refreshStatus();
        }
      } else {
        setFormError("Xác thực thất bại. Vui lòng thử lại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Đang kiểm tra trạng thái xác thực…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <Link to="/" className="text-lg font-bold text-primary">
          Rcare Plus
        </Link>
        <button
          type="button"
          className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
          aria-label="Language"
        >
          <Globe className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-4xl grid-cols-1 items-center gap-12 md:grid-cols-2">
          <div className="hidden flex-col items-center md:flex">
            <div className="flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/40 p-8">
              <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-16 w-16 text-primary" />
              </div>
              <p className="text-center text-lg font-bold leading-snug text-foreground">
                Bảo vệ hồ sơ y tế của bạn
              </p>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Xác nhận ngày sinh giúp đảm bảo chỉ bạn mới truy cập được thông tin khám bệnh.
              </p>
            </div>
          </div>

          <div>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground md:text-3xl">
              Xác nhận ngày sinh
            </h1>
            <p className="text-base text-muted-foreground">
              Vui lòng nhập ngày sinh đã đăng ký trong hồ sơ để tiếp tục sử dụng cổng bệnh nhân.
            </p>

            <div className="mt-8 rounded-xl border bg-card p-6 md:p-8">
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label
                    htmlFor="dob"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Ngày sinh
                  </label>
                  <div className="relative">
                    <Calendar
                      className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      id="dob"
                      name="dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => {
                        setDateOfBirth(e.target.value);
                        setFieldError("");
                        setFormError("");
                      }}
                      disabled={isSubmitting || lockSeconds > 0}
                      className={`${fieldClass} pl-11 ${fieldError ? fieldErrorClass : ""}`}
                      aria-invalid={Boolean(fieldError || formError)}
                      aria-describedby={fieldError || formError ? "dob-error" : undefined}
                      required
                    />
                  </div>
                  {fieldError ? (
                    <p id="dob-error" className="mt-1 text-xs text-destructive" role="alert">
                      {fieldError}
                    </p>
                  ) : null}
                </div>

                {formError ? (
                  <div
                    id="dob-error"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {formError}
                    {attemptsLeft != null && attemptsLeft > 0 && attemptsLeft < 3 ? (
                      <p className="mt-1 text-xs">Còn {attemptsLeft} lần thử.</p>
                    ) : null}
                  </div>
                ) : null}

                {lockSeconds > 0 ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    Tạm khóa. Thử lại sau {formatCountdown(lockSeconds)}.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting || lockSeconds > 0}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
                      Đang xác thực…
                    </>
                  ) : (
                    "Xác nhận"
                  )}
                </button>

                {/* <p className="text-center text-sm text-muted-foreground">
                  Quên ngày sinh?{" "}
                  <Link to="/" className="cursor-pointer font-medium text-primary hover:underline">
                    Liên hệ hỗ trợ qua trang chủ
                  </Link>
                </p> */}
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VerifyDob;
