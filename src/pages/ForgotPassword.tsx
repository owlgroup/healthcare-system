import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import EmailStep from "@/components/auth/EmailStep";
import OtpStep from "@/components/auth/OtpStep";
import PasswordStep from "@/components/auth/PasswordStep";
import { validatePasswordRules } from "@/lib/password-validation";
import {
  completePasswordReset,
  requestResetOtp,
  ResetApiError,
  verifyResetOtp,
} from "@/lib/reset-api";
import { emailSchema } from "@/lib/validations/auth";

type Step = "email" | "otp" | "password";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const passwordRules = useMemo(
    () => validatePasswordRules(password),
    [password],
  );

  const canSubmitPassword =
    passwordRules.valid &&
    password === confirmPassword &&
    Boolean(resetToken);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  const handleApiError = (err: unknown) => {
    if (err instanceof ResetApiError) {
      if (err.retryAfterSeconds) setLockSeconds(err.retryAfterSeconds);
      if (err.attemptsLeft != null) setAttemptsLeft(err.attemptsLeft);

      if (err.code === "OTP_LOCKED") {
        setErrorMessage("Đã khóa OTP. Vui lòng thử lại sau.");
      } else if (err.code === "OTP_EXPIRED") {
        setErrorMessage("OTP hết hạn. Vui lòng gửi lại mã.");
      } else if (err.code === "INVALID_OTP") {
        setErrorMessage("OTP không đúng");
      } else if (err.code === "PASSWORD_REUSED") {
        setErrorMessage(
          "Mật khẩu mới không được trùng 3 mật khẩu gần nhất.",
        );
      } else if (err.code === "RESET_FAILED") {
        setErrorMessage(
          err.message ||
            "Không thể đặt lại mật khẩu. Thử lại hoặc bắt đầu lại từ bước email.",
        );
      } else if (err.code === "INVALID_RESET_TOKEN" || err.code === "RESET_TOKEN_USED") {
        setErrorMessage("Phiên đặt lại mật khẩu hết hạn. Bắt đầu lại.");
        setStep("email");
        setResetToken(null);
      } else {
        setErrorMessage(err.message);
      }

      toast.error(err.message);
      return;
    }
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi";
    setErrorMessage(message);
    toast.error(message);
  };

  const sendOtp = async (targetEmail: string) => {
    const result = await requestResetOtp(targetEmail);
    setOtpExpiresAt(Date.now() + (result.expiresIn ?? 300) * 1000);
    setAttemptsLeft(null);
    setErrorMessage("");
    toast.success("Đã xử lý yêu cầu", {
      description: result.message,
    });
    setResendCooldown(60);
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (lockSeconds > 0) {
      setErrorMessage(`Gửi OTP tạm khóa. Thử lại sau ${lockSeconds} giây.`);
      return;
    }

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMessage(parsed.error.errors[0]?.message ?? "Email không hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalized = parsed.data.email;
      setEmail(normalized);
      await sendOtp(normalized);
      setStep("otp");
      setOtp("");
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setAttemptsLeft(null);

    if (otp.length !== 6) {
      setErrorMessage("Nhập đủ 6 chữ số OTP.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyResetOtp(email, otp);
      setResetToken(result.reset_token);
      setStep("password");
      setPassword("");
      setConfirmPassword("");
      toast.success("Xác minh OTP thành công", {
        description: "Đặt mật khẩu mới (không trùng 3 mật khẩu gần nhất).",
      });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || lockSeconds > 0) return;
    setIsSubmitting(true);
    try {
      await sendOtp(email);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!resetToken) {
      setErrorMessage("Phiên hết hạn. Vui lòng xác minh OTP lại.");
      setStep("otp");
      return;
    }

    if (!canSubmitPassword) {
      setErrorMessage("Mật khẩu chưa đủ điều kiện hoặc không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      await completePasswordReset(resetToken, password);
      toast.success("Đặt lại mật khẩu thành công", {
        description: "Đã đăng xuất mọi thiết bị. Vui lòng đăng nhập lại.",
      });
      navigate("/login", { replace: true });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === "email" ? 1 : step === "otp" ? 2 : 3;
  const stepTitle =
    step === "email"
      ? "Quên mật khẩu — Email"
      : step === "otp"
        ? "Xác minh OTP"
        : "Mật khẩu mới";

  const stepSubtitle =
    step === "email"
      ? "Nhập email đã đăng ký. Chúng tôi sẽ gửi mã OTP nếu tài khoản tồn tại."
      : step === "otp"
        ? "Nhập mã 6 chữ số từ email."
        : "Mật khẩu mới phải khác 3 mật khẩu gần nhất.";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <Link to="/" className="text-lg font-bold text-primary">
          Rcare Plus
        </Link>
        <Link
          to="/login"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 md:p-8">
          <div className="mb-6 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full ${stepIndex >= n ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          </div>

          <h2 className="mb-1 text-center text-xl font-bold text-foreground">
            {stepTitle}
          </h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            {stepSubtitle}
          </p>

          {step === "email" && (
            <ForgotEmailForm
              email={email}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              lockSeconds={lockSeconds}
              onEmailChange={setEmail}
              onSubmit={handleEmailSubmit}
            />
          )}

          {step === "otp" && (
            <OtpStep
              email={email}
              otp={otp}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              lockSeconds={lockSeconds}
              resendCooldown={resendCooldown}
              otpExpiresAt={otpExpiresAt}
              attemptsLeft={attemptsLeft}
              onOtpChange={setOtp}
              onSubmit={handleOtpSubmit}
              onBack={() => {
                setStep("email");
                setOtp("");
                setErrorMessage("");
              }}
              onResend={() => void handleResendOtp()}
            />
          )}

          {step === "password" && (
            <PasswordStep
              password={password}
              confirmPassword={confirmPassword}
              showPassword={showPassword}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              passwordRules={passwordRules}
              canSubmit={canSubmitPassword}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
              onSubmit={handlePasswordSubmit}
              submitLabel="Đặt lại mật khẩu"
              submittingLabel="Đang đặt lại..."
            />
          )}
        </div>
      </main>
    </div>
  );
};

type ForgotEmailFormProps = {
  email: string;
  isSubmitting: boolean;
  errorMessage: string;
  lockSeconds: number;
  onEmailChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

const ForgotEmailForm = ({
  email,
  isSubmitting,
  errorMessage,
  lockSeconds,
  onEmailChange,
  onSubmit,
}: ForgotEmailFormProps) => (
  <form onSubmit={onSubmit}>
    <div className="mb-4">
      <label
        htmlFor="email"
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="jordan.smith@example.com"
        autoComplete="email"
        required
        className="w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </div>

    {errorMessage ? (
      <p className="mb-4 text-sm text-destructive" role="alert">
        {errorMessage}
      </p>
    ) : null}

    {lockSeconds > 0 ? (
      <p className="mb-4 text-sm text-muted-foreground">
        Gửi OTP tạm khóa. Thử lại sau {lockSeconds}s.
      </p>
    ) : null}

    <button
      type="submit"
      disabled={isSubmitting || lockSeconds > 0}
      className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isSubmitting ? "Đang gửi..." : "Gửi mã OTP"}
    </button>

    <p className="mt-4 text-center text-xs text-muted-foreground">
      Nếu email đã đăng ký, bạn sẽ nhận mã OTP. Chúng tôi không xác nhận email
      có tồn tại hay không.
    </p>
  </form>
);

export default ForgotPassword;
