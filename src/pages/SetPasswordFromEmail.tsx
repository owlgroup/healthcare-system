import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import PasswordStep from "@/components/auth/PasswordStep";
import { parseAuthUrlError } from "@/lib/auth-hash-errors";
import { getSessionRole, loginPathForRole } from "@/lib/portal-auth";
import { validatePasswordRules } from "@/lib/password-validation";
import { supabase } from "@/lib/supabase";

const SetPasswordFromEmail = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const passwordRules = useMemo(
    () => validatePasswordRules(password),
    [password],
  );

  const canSubmit =
    passwordRules.valid && password === confirmPassword && ready && !linkError;

  useEffect(() => {
    const hashError = parseAuthUrlError(window.location.hash, window.location.search);
    if (hashError) {
      setLinkError(hashError);
      return;
    }

    let cancelled = false;

    const activate = (nextEmail?: string | null) => {
      if (cancelled) return;
      setReady(true);
      if (nextEmail) setEmail(nextEmail);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION")
      ) {
        activate(session.user.email);
      }
    });

    const run = async () => {
      await new Promise((r) => window.setTimeout(r, 200));
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setLinkError(error.message);
        return;
      }
      if (data.session) {
        activate(data.session.user.email);
        return;
      }

      window.setTimeout(async () => {
        if (cancelled) return;
        const retry = await supabase.auth.getSession();
        if (retry.data.session) {
          activate(retry.data.session.user.email);
        } else if (!parseAuthUrlError(window.location.hash, window.location.search)) {
          setLinkError(
            "Không nhận được phiên đăng nhập từ link email. Link có thể đã hết hạn — nhờ Quản trị viên gửi lại email thiết lập mật khẩu.",
          );
        }
      }, 2500);
    };

    void run();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!canSubmit) {
      setErrorMessage("Mật khẩu chưa đủ điều kiện hoặc không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: sessionBefore } = await supabase.auth.getSession();
      const role = getSessionRole(sessionBefore.session);

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const loginPath = loginPathForRole(role);

      await supabase.auth.signOut();

      toast.success("Đặt mật khẩu thành công", {
        description: "Vui lòng đăng nhập bằng mật khẩu vừa tạo.",
      });
      navigate(loginPath, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể đặt mật khẩu. Thử lại.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          Đăng nhập
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 md:p-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>

          <h2 className="mb-1 text-center text-xl font-bold text-foreground">
            Thiết lập mật khẩu lần đầu
          </h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            {email
              ? `Tài khoản: ${email}`
              : "Xác nhận email và tạo mật khẩu để đăng nhập hệ thống."}
          </p>

          {linkError ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive" role="alert">
                {linkError}
              </p>
              <p className="text-xs text-muted-foreground">
                Nếu link đã hết hạn, Quản trị viên có thể vào{" "}
                <strong>Quản lý người dùng → Đặt lại mật khẩu</strong> để gửi
                email mới.
              </p>
              <Link
                to="/login"
                className="block text-center text-sm font-semibold text-primary underline"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-muted-foreground">
              Đang xác nhận link email...
            </p>
          ) : (
            <PasswordStep
              password={password}
              confirmPassword={confirmPassword}
              showPassword={showPassword}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              passwordRules={passwordRules}
              canSubmit={canSubmit}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
              onSubmit={handleSubmit}
              submitLabel="Lưu mật khẩu"
              submittingLabel="Đang lưu..."
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SetPasswordFromEmail;
