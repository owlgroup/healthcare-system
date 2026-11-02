import { Link, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Cách thức hoạt động", href: "#how-it-works" },
  { label: "Dịch vụ chăm sóc", href: "#our-care" },
  { label: "Về chúng tôi", href: "/about" },
  { label: "Bảng giá", href: "#cta" },
];

const LandingHeader = () => {
  const { session } = useAuth();
  const location = useLocation();
  const isAboutPage = location.pathname === "/about";
  const user = session?.user;
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const resolveHref = (href: string) => {
    if (href.startsWith("/")) return href;
    return isAboutPage ? `/${href}` : href;
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 max-w-7xl mx-auto w-full">
      <Link to="/" className="text-lg font-bold text-primary">
        Rcare Plus
      </Link>
      <nav className="hidden md:flex items-center gap-8">
        {navItems.map((item) => {
          const href = resolveHref(item.href);
          const isActive = item.href === "/about" && isAboutPage;
          const className = `text-sm font-medium transition-colors ${
            isActive
              ? "text-foreground underline underline-offset-4"
              : "text-muted-foreground hover:text-foreground"
          }`;

          return item.href.startsWith("/") ? (
            <Link key={item.label} to={href} className={className}>
              {item.label}
            </Link>
          ) : (
            <a key={item.label} href={href} className={className}>
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40">
                <Avatar className="h-9 w-9 cursor-pointer border border-border hover:ring-2 hover:ring-primary/30 transition-shadow">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2 border-b">
                <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                {user.email && displayName !== user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/account">
                  <LayoutDashboard className="h-4 w-4" />
                  Khu vực của bạn
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleLogout()}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Đăng nhập
          </Link>
        )}
        <Link
          to="/signup"
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Bắt đầu
        </Link>
      </div>
    </header>
  );
};

export default LandingHeader;
