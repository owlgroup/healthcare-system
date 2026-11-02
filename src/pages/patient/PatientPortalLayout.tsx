import { Home, Calendar, ClipboardList, ListChecks, LogOut, Bell, Settings, Search, User } from 'lucide-react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { portalLogout } from '@/lib/portal-auth-api';
import { loginPathForRole } from '@/lib/portal-auth';
import { toast } from 'sonner';

const SIDEBAR_NAV = [
  { icon: Home,          label: 'Trang chủ',       path: '/patient/home' },
  { icon: Calendar,      label: 'Đặt lịch khám',   path: '/patient/book-appointment' },
  { icon: ClipboardList, label: 'Khai báo y tế',   path: '/patient/health-declaration', badge: true },
  { icon: ListChecks,    label: 'Lịch khám',        path: '/patient/appointments' },
];

export default function PatientPortalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, role } = useAuth();

  const displayName = session?.user?.user_metadata?.full_name
    ?? session?.user?.email?.split('@')[0]
    ?? 'Bệnh nhân';

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    try {
      await portalLogout();
      toast.success('Đã đăng xuất');
      navigate(loginPathForRole(role), { replace: true });
    } catch {
      toast.error('Không thể đăng xuất');
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-56 flex-col bg-white border-r border-gray-100 fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <span className="font-bold text-gray-800 text-base">RCARE</span>
        </div>

        {/* Section label */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
            Cổng bệnh nhân
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {SIDEBAR_NAV.map(({ icon: Icon, label, path, badge }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  active
                    ? 'bg-pink-50 text-pink-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-pink-500' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className="flex-1 truncate">{label}</span>
                {badge && (
                  <span className="h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    !
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400 truncate">Bệnh nhân</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Cổng Bệnh nhân</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-semibold">
              {SIDEBAR_NAV.find(n => location.pathname.startsWith(n.path))?.label ?? 'Trang'}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Search hint */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-400 min-w-52 border border-gray-100">
              <Search className="h-3.5 w-3.5" />
              <span>Tìm bệnh nhân, mã hồ sơ, ICD...</span>
            </div>
            <button className="relative p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <Bell className="h-4 w-4 text-gray-500" />
            </button>
            <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <Settings className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
