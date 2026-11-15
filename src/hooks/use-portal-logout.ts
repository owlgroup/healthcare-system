import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { portalLogout } from "@/lib/portal-auth-api";
import { loginPathForRole } from "@/lib/portal-auth";

export function usePortalLogout(): () => Promise<void> {
  const navigate = useNavigate();
  const { role } = useAuth();

  return async function logout() {
    try {
      await portalLogout();
      toast.success("Đã đăng xuất");
      navigate(loginPathForRole(role), { replace: true });
    } catch {
      toast.error("Không thể đăng xuất");
    }
  };
}
