import { NavLink, useLocation } from "react-router-dom";
import { ACCOUNT_MENU_GROUPS } from "@/config/account-menu";
import { cn } from "@/lib/utils";

const AccountSubNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="flex w-full shrink-0 flex-col gap-1 rounded-2xl border border-border/70 bg-card p-3 shadow-sm md:w-56 lg:w-60"
      aria-label="Menu tài khoản"
    >
      {ACCOUNT_MENU_GROUPS.map((group, groupIndex) => {
        const GroupIcon = group.icon;
        const groupActive = group.items.some(
          (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
        );

        return (
          <div key={group.id} className={cn(groupIndex > 0 && "mt-2 border-t border-border/60 pt-3")}>
            <div
              className={cn(
                "mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2",
                groupActive ? "bg-primary/8" : "bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  groupActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground",
                )}
              >
                <GroupIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <p
                className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  groupActive ? "text-primary" : "text-foreground/70",
                )}
              >
                {group.label}
              </p>
            </div>

            <div className="flex flex-col gap-0.5 pl-1">
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          <ItemIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default AccountSubNav;
