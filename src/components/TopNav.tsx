import { Bell, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { isPatientMenuActive, PATIENT_MENU_GROUPS } from "@/config/patient-menu";

function getPageTitle(pathname: string): string {
  for (const group of PATIENT_MENU_GROUPS) {
    for (const item of group.items) {
      if (isPatientMenuActive(pathname, item.path)) {
        return item.label;
      }
    }
  }
  return "Trang";
}

const TopNav = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
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

  const pageTitle = getPageTitle(location.pathname);

  function handleNotification() {
    toast.info("Không có thông báo mới");
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-slate-200 px-6 lg:px-9 flex items-center justify-between">
      {/* Left: Mobile menu + Page title */}
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            <div className="px-5 py-5 border-b border-slate-100">
              <span className="text-xl font-extrabold text-slate-800">
                RCare <span className="text-teal-600">Plus</span>
              </span>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
              {PATIENT_MENU_GROUPS.map((group) => (
                <div key={group.label} className="mb-2">
                  <div className="px-3 pt-4 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    {group.label}
                  </div>
                  {group.items.map(({ icon: Icon, label, path, iconColor }) => {
                    const active = isPatientMenuActive(location.pathname, path);
                    return (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-slate-800 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-5 ${active ? "text-white" : iconColor || "text-slate-500"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}

              {/* Profile section in mobile menu */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{displayName}</div>
                    <div className="text-xs text-slate-500 truncate">{session?.user?.email}</div>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <h1 className="text-lg font-bold text-slate-800">{pageTitle}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleNotification}
          className="w-[42px] h-[42px] rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <Bell className="h-4 w-4 text-slate-700" />
        </button>
      </div>
    </header>
  );
};

export default TopNav;
