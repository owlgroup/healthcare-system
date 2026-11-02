import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import EmailStep from "@/components/auth/EmailStep";
import OtpStep from "@/components/auth/OtpStep";
import PasswordStep from "@/components/auth/PasswordStep";
import { useAuth } from "@/hooks/use-auth";
import { validatePasswordRules } from "@/lib/password-validation";
import {
  applySignupSession,
  completeSignup,
  requestSignupOtp,
  SignupApiError,
  verifySignupOtp,
  type SignupSession,
} from "@/lib/signup-api";
import { emailSchema } from "@/lib/validations/auth";

type Step = "email" | "otp" | "password";

const Signup = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingSession, setPendingSession] = useState<SignupSession | null>(null);
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
    Boolean(pendingSession);

  useEffect(() => {
    if (!isLoading && session && step === "email") {
      navigate("/onboarding", { replace: true });
    }
  }, [session, isLoading, step, navigate]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("e2e") !== "password") return;
    const e2eEmail = params.get("email");
    if (e2eEmail) setEmail(e2eEmail);
    setPendingSession({
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
    });
    setStep("password");
  }, []);

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
    if (err instanceof SignupApiError) {
      if (err.retryAfterSeconds) {
        setLockSeconds(err.retryAfterSeconds);
      }
      if (err.attemptsLeft != null) {
        setAttemptsLeft(err.attemptsLeft);
      }

      if (err.code === "EMAIL_EXISTS") {
        setErrorMessage("Tài khoản đã tồn tại");
      } else if (err.code === "OTP_LOCKED") {
        setErrorMessage("Đã khóa OTP. Vui lòng thử lại sau.");
      } else if (err.code === "OTP_EXPIRED") {
        setErrorMessage("OTP hết hạn. Vui lòng gửi lại mã.");
      } else if (err.code === "INVALID_OTP") {
        setErrorMessage("OTP không đúng");
      } else if (err.code === "SEND_FAILED") {
        setErrorMessage(err.message);
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
    const result = await requestSignupOtp(targetEmail);
    setOtpExpiresAt(Date.now() + (result.expiresIn ?? 300) * 1000);
    setAttemptsLeft(null);
    setErrorMessage("");
    toast.success("Đã gửi OTP", {
      description: "Kiểm tra email (Supabase Auth — cả hộp thư Spam).",
    });
    setResendCooldown(60);
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!agreed) {
      const message =
        "Vui lòng đồng ý Điều khoản dịch vụ và Chính sách quyền riêng tư.";
      setErrorMessage(message);
      toast.error("Cần đồng ý điều khoản", { description: message });
      return;
    }

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
      const result = await verifySignupOtp(email, otp);
      setPendingSession(result.session);
      setStep("password");
      setPassword("");
      setConfirmPassword("");
      toast.success("Xác minh OTP thành công", {
        description: "Đặt mật khẩu để hoàn tất đăng ký.",
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

    if (!pendingSession) {
      setErrorMessage("Phiên đăng ký hết hạn. Vui lòng xác minh OTP lại.");
      setStep("otp");
      return;
    }

    if (!canSubmitPassword) {
      setErrorMessage("Mật khẩu chưa đủ điều kiện hoặc không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { session: finalSession } = await completeSignup(
        pendingSession,
        password,
      );
      await applySignupSession(finalSession);
      toast.success("Đăng ký thành công", {
        description: "Đang chuyển đến tạo hồ sơ...",
      });
      navigate("/onboarding", { replace: true });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === "email" ? 1 : step === "otp" ? 2 : 3;
  const stepTitle =
    step === "email"
      ? "Bước 1: Nhập email"
      : step === "otp"
        ? "Bước 2: Xác minh OTP"
        : "Bước 3: Đặt mật khẩu";

  const stepSubtitle =
    step === "email"
      ? "Nhập email — supabase.auth.signInWithOtp gửi mã 6 số."
      : step === "otp"
        ? "Nhập mã từ email (hiệu lực 5 phút)."
        : "Tạo mật khẩu — Supabase Auth lưu hash an toàn.";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

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
          Đã có tài khoản? Đăng nhập
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-12 lg:grid-cols-2">
          <div className="hidden pt-8 lg:block">
            <span className="mb-4 inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
              Care for All
            </span>
            <h1 className="mb-4 text-3xl font-bold leading-tight text-foreground md:text-4xl">
              A clinical sanctuary built around{" "}
              <span className="text-primary">you</span>.
            </h1>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Đăng ký 3 bước: Email → OTP → Mật khẩu.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  HIPAA Compliant
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 md:p-8">
            <div className="mb-6 flex gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full ${stepIndex >= n ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>

            <h2 className="mb-1 text-xl font-bold text-foreground">{stepTitle}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{stepSubtitle}</p>

            {step === "email" && (
              <EmailStep
                email={email}
                agreed={agreed}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                lockSeconds={lockSeconds}
                onEmailChange={setEmail}
                onAgreedChange={setAgreed}
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
              />
            )}
          </div>
        </div>
      </main>

      <footer className="flex border-t px-6 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          © 2024 Rcare Plus Clinical Services.
        </p>
      </footer>
    </div>
  );
};

export default Signup;
