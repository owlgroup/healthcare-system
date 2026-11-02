import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { stashAuthReturnTo, homePathForRole } from "@/lib/portal-auth";
import { portalLoginMessage } from "@/types/portal";
import type { PortalType } from "@/types/portal";
import { PORTAL_CONFIG } from "@/types/portal";

type ProtectedRouteProps = {
  children: ReactNode;
  requiredPortal?: PortalType;
};

const ProtectedRoute = ({ children, requiredPortal }: ProtectedRouteProps) => {
  const { session, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </div>
    );
  }

  const loginPath = requiredPortal
    ? PORTAL_CONFIG[requiredPortal].loginPath
    : PORTAL_CONFIG.patient.loginPath;

  if (!session) {
    stashAuthReturnTo(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (requiredPortal) {
    if (!role) {
      stashAuthReturnTo(`${location.pathname}${location.search}${location.hash}`);
      return <Navigate to={loginPath} replace state={{ from: location }} />;
    }
    if (role !== requiredPortal) {
      return (
        <Navigate
          to={homePathForRole(role)}
          replace
          state={{
            portalError: portalLoginMessage(requiredPortal),
          }}
        />
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
