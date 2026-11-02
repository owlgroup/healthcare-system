import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  FileUser,
  LayoutDashboard,
  LogOut,
  ScrollText,
  UserCircle,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useMatch, Link } from "react-router-dom";
import { toast } from "sonner";
import { UI_ACTION, UI_CHECKED_IN, UI_CHECK_IN, UI_WALK_IN } from "@/config/ui-labels";
import { logoutAndRedirectTo } from "@/lib/auth-session";
import { useDoctorNotifications } from "@/hooks/DoctorNotificationsContext";
import NotificationPanel from "@/components/admin/NotificationPanel";
import type { AppointmentNotification } from "@/hooks/useAdminNotifications";
import {
  getMyDoctorProfile,
  type DoctorProfile,
} from "@/lib/doctor-profile-api";
import { createAvatarSignedUrl } from "@/lib/doctor-avatar-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { path: "/provider-portal/dashboard", icon: LayoutDashboard, label: "Bảng tổng quan" },
  { path: "/provider-portal/patient-records", icon: FileUser, label: "Hồ sơ bệnh nhân" },
  { path: "/provider-portal/patients", icon: Users, label: "Bệnh nhân" },
  { path: "/provider-portal/appointments", icon: Calendar, label: "Lịch hẹn" },
  { path: "/provider-portal/medical-history", icon: ScrollText, label: "Lịch sử khám bệnh" },
  { path: "/provider-portal/profile", icon: UserCircle, label: "Hồ sơ bác sĩ" },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
    isActive
      ? "border-l-4 border-primary bg-[#FDECEE] pl-2 text-primary"
      : "border-l-4 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;

function formatDoctorTitle(specialty: string | null | undefined): string {
  if (!specialty?.trim()) return "Bác sĩ";
  const trimmed = specialty.trim();
  if (/^bác sĩ/i.test(trimmed)) return trimmed;
  return `Bác sĩ chuyên khoa ${trimmed}`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "BS";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ProviderLayout = () => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isExamination = Boolean(useMatch("/provider-portal/examination/:appointmentId"));
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useDoctorNotifications();

  useEffect(() => {
    let cancelled = false;
    void getMyDoctorProfile()
      .then(async (data) => {
        if (cancelled) return;
        setProfile(data);
        if (data.avatar_storage_path) {
          const url = await createAvatarSignedUrl(data.avatar_storage_path);
          if (!cancelled) setAvatarUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.full_name?.trim() || "Bác sĩ";
  const displayTitle = formatDoctorTitle(profile?.specialty);

  const mappedNotifications = useMemo<AppointmentNotification[]>(
    () =>
      notifications.map((n) => ({
        id: n.id,
        appointmentId: n.appointmentId ?? "",
        patientName: n.patientName,
        specialtyName: n.specialtyName,
        slotDate: n.slotDate,
        startTime: n.slotTime,
        walkIn: n.walkIn,
        createdAt: n.createdAt,
        read: n.read,
      })),
    [notifications],
  );

  const handleLogout = () => {
    setIsLoggingOut(true);
    void logoutAndRedirectTo("/").catch(() => {
      setIsLoggingOut(false);
      toast.error("Không đăng xuất được");
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#provider-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        {UI_ACTION.skipToMain}
      </a>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-r bg-card px-4 py-5">
          <div className="mb-5 flex items-center gap-2.5 border-b pb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-black text-primary-foreground">R</span>
            </div>
            <span className="text-base font-bold tracking-tight text-primary">RCARE</span>
          </div>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={navLinkClass}
                end={path === "/provider-portal/dashboard"}
                isActive={(_, { pathname }) =>
                  path === "/provider-portal/appointments"
                    ? pathname.startsWith("/provider-portal/appointments") ||
                      pathname.startsWith("/provider-portal/examination")
                    : pathname === path || pathname.startsWith(`${path}/`)
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-10 space-y-2 border-t pt-5">
            <button
              type="button"
              disabled={isLoggingOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          </div>
        </aside>

        <main
          id="provider-main-content"
          className={
            isExamination
              ? "flex h-screen flex-col overflow-hidden"
              : "p-5 md:p-6 lg:p-8"
          }
        >
          {!isExamination && (
            <header className="mb-6 flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="flex min-w-0 max-w-[300px] items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                      aria-label="Mở menu hồ sơ"
                    >
                      <Avatar className="h-16 w-16 ring-1 ring-border transition-opacity hover:opacity-90">
                        <AvatarImage src={avatarUrl ?? undefined} alt={profile?.full_name ?? "Avatar"} />
                        <AvatarFallback className="text-lg bg-primary/10 text-primary">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to="/provider-portal/profile" className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" aria-hidden="true" />
                        Hồ sơ bác sĩ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isLoggingOut}
                      className="gap-2"
                      onSelect={() => {
                        handleLogout();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug text-foreground">{displayName}</p>
                  <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">{displayTitle}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <NotificationPanel
                  notifications={mappedNotifications}
                  unreadCount={unreadCount}
                  onMarkAllAsRead={() => { void markAllAsRead(); }}
                  onMarkAsRead={(id) => { void markAsRead(id); }}
                  onClearAll={clearAll}
                  appointmentsPath="/provider-portal/appointments"
                />
                <Link
                  to="/provider-portal/profile"
                  className="rounded-xl border px-4 py-2.5 transition-colors hover:bg-muted"
                >
                  <p className="text-sm font-semibold leading-snug">Hồ sơ bác sĩ</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">PIN ký duyệt</p>
                </Link>
              </div>
            </header>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProviderLayout;
