import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePatientDobVerification } from "@/hooks/usePatientDobVerification";
import { stashDobReturnTo, VERIFY_DOB_PATH } from "@/lib/portal-auth";

type PatientDobGuardProps = {
  children: ReactNode;
};

const PatientDobGuard = ({ children }: PatientDobGuardProps) => {
  const { role } = useAuth();
  const location = useLocation();
  const { isVerified, isLoading, requiresOnboarding } = usePatientDobVerification();

  if (role !== "patient") {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Đang kiểm tra xác thực ngày sinh…</p>
      </div>
    );
  }

  if (requiresOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isVerified) {
    const returnPath = `${location.pathname}${location.search}${location.hash}`;
    stashDobReturnTo(returnPath);
    return <Navigate to={VERIFY_DOB_PATH} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default PatientDobGuard;
