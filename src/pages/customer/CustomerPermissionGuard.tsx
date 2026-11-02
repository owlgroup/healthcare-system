import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccessCustomerRoute, resolveCustomerNavPath } from "@/config/rbac-menu";

/** Blocks customer portal pages the current role lacks permission for. */
const CustomerPermissionGuard = () => {
  const location = useLocation();
  const { permissions, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Đang tải quyền...
      </div>
    );
  }

  const navPath = resolveCustomerNavPath(location.pathname);
  if (!canAccessCustomerRoute(permissions, navPath)) {
    return <Navigate to="/customer-portal/overview" replace />;
  }

  return <Outlet />;
};

export default CustomerPermissionGuard;
