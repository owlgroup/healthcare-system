import { useState } from "react";
import {
  LayoutGrid, CalendarDays, FileUser, Shield, LogOut, Menu, Loader2, Database, Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { UI_ACTION } from "@/config/ui-labels";
import { logoutAndRedirectTo } from "@/lib/auth-session";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccessCustomerRoute } from "@/config/rbac-menu";

const sidebarItems = [
  { icon: LayoutGrid, label: "Bảng tổng quan", path: "/customer-portal/overview" },
  { icon: FileUser, label: "Hồ sơ bệnh nhân", path: "/customer-portal/patient-records" },
  { icon: Users, label: "Bệnh nhân (module BS)", path: "/customer-portal/patients" },
  { icon: CalendarDays, label: "Lịch hẹn", path: "/customer-portal/appointments" },
  { icon: Database, label: "Danh mục", path: "/customer-portal/master-data" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "border-l-4 border-primary bg-[#FDECEE] pl-2 text-primary"
      : "border-l-4 border-transparent text-muted-foreground hover:bg-muted"
  }`;

const CustomerSidebarContent = ({
  onNavigate,
  onLogout,
  isLoggingOut,
  visibleItems,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  visibleItems: typeof sidebarItems;
}) => (
  <>
    <div className="flex items-center gap-3 p-4 border-b">
      <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
        <Shield className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <p className="text-sm font-bold text-primary">Rcare Plus</p>
        <p className="text-xs text-muted-foreground">Portal Nhân viên</p>
      </div>
    </div>
    <nav className="flex flex-col gap-1 p-3 flex-1">
      {visibleItems.map(({ icon: Icon, label, path }) => (
        <NavLink
          key={path}
          to={path}
          className={navLinkClass}
          onClick={onNavigate}
          end={path === "/customer-portal/overview"}
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 mt-auto border-t">
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={onLogout}
        className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg w-full disabled:opacity-50"
      >
        {isLoggingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {isLoggingOut ? UI_ACTION.loggingOut : UI_ACTION.logout}
      </button>
    </div>
  </>
);

const CustomerLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const { permissions, isLoading: permsLoading } = usePermissions();

  const visibleItems = sidebarItems.filter((item) => canAccessCustomerRoute(permissions, item.path));

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
        <CustomerSidebarContent
          visibleItems={visibleItems}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" className="lg:hidden p-2 rounded-lg hover:bg-muted">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <CustomerSidebarContent
                  visibleItems={visibleItems}
                  onNavigate={() => setMobileOpen(false)}
                  onLogout={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  isLoggingOut={isLoggingOut}
                />
              </SheetContent>
            </Sheet>
            <p className="text-sm font-semibold text-foreground">Portal Nhân viên</p>
            {permsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
