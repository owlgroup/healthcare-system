import { useState } from "react";
import {
  LayoutGrid, GitBranch, FileText, BarChart3, UserCog,
  LogOut, Menu, Loader2, ArrowLeft, HeartPulse,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { logoutAndRedirectTo } from "@/lib/auth-session";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const sidebarItems = [
  { icon: LayoutGrid, label: "Bảng tổng quan",      path: "/admin/clinical-logic/dashboard" },
  { icon: GitBranch,  label: "Cây quyết định",      path: "/admin/clinical-logic/decision-trees" },
  { icon: FileText,   label: "Thư viện câu hỏi",    path: "/admin/clinical-logic/question-library" },
  { icon: BarChart3,  label: "Phân tích",           path: "/admin/clinical-logic/analytics" },
  { icon: UserCog,    label: "Phân quyền nhân sự",  path: "/admin/clinical-logic/staff-access" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? "text-primary bg-accent" : "text-muted-foreground hover:bg-muted"
  }`;

const ClinicalLogicSidebarContent = ({
  onNavigate,
  onLogout,
  isLoggingOut,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) => (
  <>
    <div className="flex items-center gap-3 p-4 border-b">
      <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
        <HeartPulse className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <p className="text-sm font-bold text-primary">Logic lâm sàng</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hệ thống hỗ trợ đồng cảm</p>
      </div>
    </div>
    <nav className="flex flex-col gap-1 p-3 flex-1">
      <NavLink to="/admin/patient-records" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />
        Cổng quản trị
      </NavLink>
      {sidebarItems.map(({ icon: Icon, label, path }) => (
        <NavLink key={path} to={path} className={navLinkClass} onClick={onNavigate}>
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 mt-auto border-t space-y-1">
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={onLogout}
        className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg w-full disabled:opacity-50"
      >
        {isLoggingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        {isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </div>
  </>
);

const ClinicalLogicLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    setIsLoggingOut(true);
    void logoutAndRedirectTo("/").catch(() => {
      setIsLoggingOut(false);
      toast.error("Không đăng xuất được");
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:flex w-60 flex-col border-r bg-card h-screen sticky top-0">
        <ClinicalLogicSidebarContent onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button type="button" className="lg:hidden p-2 rounded-lg hover:bg-muted">
                <Menu className="h-5 w-5 text-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <ClinicalLogicSidebarContent
                onNavigate={() => setMobileOpen(false)}
                onLogout={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                isLoggingOut={isLoggingOut}
              />
            </SheetContent>
          </Sheet>
          <div className="hidden lg:block" />
          <p className="text-sm font-semibold text-foreground">Quản trị viên</p>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ClinicalLogicLayout;
