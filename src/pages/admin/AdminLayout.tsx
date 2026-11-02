import { useState } from "react";
import {
  Users, Search,
  LogOut, Menu, Loader2, FileUser, FolderOpen, CalendarDays, ClipboardList, Brain, KeyRound, UserRound, Stethoscope, Shield, ScrollText,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { logoutAndRedirectTo } from "@/lib/auth-session";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotificationPanel from "@/components/admin/NotificationPanel";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";

const sidebarItems = [
  { icon: FileUser,      label: "Hồ sơ bệnh nhân",     path: "/admin/patient-records" },
  { icon: UserRound,     label: "Bệnh nhân",           path: "/admin/patients" },
  { icon: CalendarDays,  label: "Lịch hẹn",            path: "/admin/appointments" },
  { icon: FolderOpen,    label: "Danh mục",            path: "/admin/master-data" },
  { icon: ClipboardList, label: "Bộ câu hỏi lâm sàng", path: "/admin/question-library" },
  { icon: Users,         label: "Người dùng",          path: "/admin/users" },
  { icon: KeyRound,      label: "Danh sách quyền",     path: "/admin/permissions" },
  { icon: Shield,        label: "Quản lý vai trò",     path: "/admin/roles" },
  { icon: Brain,         label: "Độ chính xác AI",     path: "/admin/ai-accuracy" },
  { icon: ScrollText,    label: "Nhật ký hệ thống",    path: "/admin/delta-log" },
];

const getPageTitle = (pathname: string) =>
  sidebarItems.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.label ??
  "Bảng điều khiển";

const formatToday = () => {
  const text = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const navLinkClass =({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
    isActive
      ? "rounded-l-full bg-accent text-primary font-bold shadow-sm"
      : "rounded-lg text-muted-foreground hover:bg-muted"
  }`;

const AdminSidebarContent = ({
  onNavigate,
  onLogout,
  isLoggingOut,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) => (
    <>
      <div className="px-6 mb-8 flex items-center gap-3 pt-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Stethoscope className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xl font-black text-primary leading-tight">Rcare Plus</p>
          <p className="text-[11px] font-medium text-muted-foreground">Vận hành hệ thống</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3 flex-1 overflow-y-auto">
        {sidebarItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            className={navLinkClass}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pt-6 mt-auto border-t">
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg w-full disabled:opacity-50 transition-colors"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          {isLoggingOut ? "Đang đăng xuất…" : "Đăng Xuất"}
        </button>
      </div>
    </>
);

const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const { notifications, unreadCount, markAllAsRead, markAsRead, clearAll } = useAdminNotifications();
  const { session } = useAuth();
  const user = session?.user;
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? "Quản trị viên";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    setIsLoggingOut(true);
    void logoutAndRedirectTo("/").catch(() => {
      setIsLoggingOut(false);
      toast.error("Không đăng xuất được");
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex w-[260px] flex-col border-r bg-card h-full shrink-0 z-30">
        <AdminSidebarContent onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Ambient blur effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 mix-blend-soft-light z-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-success rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
        </div>

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" className="lg:hidden p-2 rounded-lg hover:bg-muted">
                  <Menu className="h-5 w-5 text-foreground" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <AdminSidebarContent
                  onNavigate={() => setMobileOpen(false)}
                  onLogout={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  isLoggingOut={isLoggingOut}
                />
              </SheetContent>
            </Sheet>
            <div className="flex flex-col leading-tight min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {getPageTitle(location.pathname)}
              </h1>
              <p className="text-xs text-muted-foreground truncate">{formatToday()}</p>
            </div>
            {/* <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Tìm kiếm các chỉ số vận hành..."
                className="w-full bg-muted border-none rounded-full py-1.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div> */}
          </div>
          <div className="flex items-center gap-6">
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
              onClearAll={clearAll}
            />
            <div className="flex items-center gap-3 border-l border-border pl-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-foreground leading-tight">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">Admin Dashboard</p>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials || "AD"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 relative z-10" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
