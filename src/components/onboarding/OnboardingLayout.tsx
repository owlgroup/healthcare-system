import { ShieldCheck, Sparkles } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

const OnboardingLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="text-lg font-bold text-primary">
            Rcare Plus
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex min-h-9 items-center gap-1 rounded-full border bg-card px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Tuân thủ HIPAA
            </span>
            <span className="inline-flex min-h-9 items-center gap-1 rounded-full border bg-card px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Chăm sóc toàn diện
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border bg-card p-5 shadow-sm md:p-8">
          <div className="mx-auto w-full max-w-4xl">
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground md:flex-row md:px-8">
          <p>Rcare Plus — Mạng lâm sàng</p>
          <div className="flex items-center gap-4">
            <button className="hover:text-foreground">Chính sách bảo mật</button>
            <button className="hover:text-foreground">Điều khoản dịch vụ</button>
            <button className="hover:text-foreground">Quyền bệnh nhân</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingLayout;
