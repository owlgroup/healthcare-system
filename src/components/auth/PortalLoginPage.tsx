import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { portalLogin, PortalAuthError } from "@/lib/portal-auth-api";
import { PORTAL_CONFIG, type PortalType } from "@/types/portal";

type PortalLoginPageProps = {
  portal: PortalType;
};

const PortalLoginPage = ({ portal }: PortalLoginPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const config = PORTAL_CONFIG[portal];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lockSeconds, setLockSeconds] = useState(0);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? config.homePath;

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (lockSeconds > 0) {
      setErrorMessage(`Tài khoản tạm khóa. Thử lại sau ${lockSeconds}s.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await portalLogin(portal, email.trim(), password);
      toast.success("Đăng nhập thành công");
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof PortalAuthError) {
        if (err.retryAfterSeconds) {
          setLockSeconds(err.retryAfterSeconds);
        }
        if (err.code === "WRONG_PORTAL") {
          setErrorMessage(err.message);
        } else if (err.code === "ACCOUNT_LOCKED") {
          setErrorMessage(err.message);
        } else if (err.code === "INVALID_CREDENTIALS") {
          const left =
            err.attemptsLeft != null ? ` (Còn ${err.attemptsLeft} lần thử)` : "";
          setErrorMessage(`${err.message}${left}`);
        } else {
          setErrorMessage(err.message);
        }
        toast.error(err.message);
      } else {
        const message = err instanceof Error ? err.message : "Đăng nhập thất bại";
        setErrorMessage(message);
        toast.error(message);
      }
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
        <button
          type="button"
          className="rounded-lg p-2 transition-colors hover:bg-muted"
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
                {config.title}
              </p>
            </div>
          </div>

          <div>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground md:text-3xl">
              {config.title}
            </h1>
            <p className="text-sm text-muted-foreground">{config.subtitle}</p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 rounded-xl border bg-card p-6 md:p-8"
            >
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@example.com"
                autoComplete="email"
                required
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
              />

              <label
                htmlFor="password"
                className="mb-2 mt-4 block text-sm font-medium text-foreground"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
              />

              {errorMessage ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              {lockSeconds > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Tài khoản khóa còn {lockSeconds}s
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || lockSeconds > 0}
                className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="my-5 border-t" />

              <p className="text-center text-sm text-muted-foreground">
                <Link
                  to={config.forgotPasswordPath}
                  className="font-semibold text-primary hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </p>
            </form>

            {config.signupPath ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Chưa có tài khoản?{" "}
                <Link
                  to={config.signupPath}
                  className="font-semibold text-primary hover:underline"
                >
                  Đăng ký
                </Link>
              </p>
            ) : null}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Cổng khác:{" "}
              {(["patient", "doctor", "admin"] as PortalType[])
                .filter((p) => p !== portal)
                .map((p, i, arr) => (
                  <span key={p}>
                    <Link
                      to={PORTAL_CONFIG[p].loginPath}
                      className="font-semibold text-primary hover:underline"
                    >
                      {PORTAL_CONFIG[p].title}
                    </Link>
                    {i < arr.length - 1 ? " · " : null}
                  </span>
                ))}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PortalLoginPage;
