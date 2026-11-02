import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Stethoscope } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { portalLogout } from "@/lib/portal-auth-api";
import { loginPathForRole } from "@/lib/portal-auth";
import { toast } from "sonner";
import { isPatientMenuActive, PATIENT_MENU_GROUPS } from "@/config/patient-menu";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const { data: profile } = useMyPatientProfile();

  const displayName =
    profile?.full_name?.trim() ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split("@")[0] ||
    "Bệnh nhân";

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const email = session?.user?.email ?? "";

  async function handleLogout() {
    try {
      await portalLogout();
      toast.success("Đã đăng xuất");
      navigate(loginPathForRole(role), { replace: true });
    } catch {
      toast.error("Không thể đăng xuất");
    }
  }

  return (
    <aside className="hidden lg:flex w-[280px] flex-col bg-white border-r border-slate-200 fixed top-0 left-0 h-full z-30">
      {/* Brand */}
      <div className="flex items-center justify-between px-[22px] py-6 border-b border-slate-100">
        <Link to="/home" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-md">
            <Stethoscope className="h-[17px] w-[17px] text-white" />
          </div>
          <span className="text-[22px] font-extrabold tracking-tight text-slate-800">
            RCare <span className="text-teal-600">Plus</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        {PATIENT_MENU_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-3.5 pt-4 pb-1.5 text-[12px] font-bold tracking-wider text-slate-400 uppercase">
              {group.label}
            </div>
            {group.items.map(({ icon: Icon, label, path, iconColor, comingSoon }) => {
              const active = isPatientMenuActive(location.pathname, path);

              if (comingSoon) {
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => toast.info("Tính năng đang phát triển", { description: "Chức năng này sẽ sớm được cập nhật." })}
                    className="flex items-center gap-3 px-3.5 py-[11px] rounded-[10px] text-[15px] font-medium transition-all text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left"
                  >
                    <span className={`flex items-center justify-center w-[22px] ${iconColor || "text-slate-500"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-3.5 py-[11px] rounded-[10px] text-[15px] font-medium transition-all ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={`flex items-center justify-center w-[22px] ${active ? "text-white" : iconColor || "text-slate-500"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Profile Footer */}
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-[10px] hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[15px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-slate-800 truncate">{displayName}</div>
            <div className="text-[13.5px] text-slate-500 truncate">{email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
