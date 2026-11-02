import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getPatientDobStatus,
  parsePatientDobError,
  verifyPatientDob,
  type PatientDobStatus,
} from "@/lib/patient-dob-api";
import { useAuth } from "@/hooks/use-auth";

type PatientDobContextValue = {
  isVerified: boolean;
  isLoading: boolean;
  requiresOnboarding: boolean;
  lockSeconds: number;
  attemptsLeft: number | null;
  refreshStatus: () => Promise<void>;
  verify: (dateOfBirth: string) => Promise<void>;
};

const PatientDobContext = createContext<PatientDobContextValue | undefined>(undefined);

function applyStatus(
  status: PatientDobStatus,
  setters: {
    setIsVerified: (v: boolean) => void;
    setRequiresOnboarding: (v: boolean) => void;
    setLockSeconds: (v: number) => void;
  },
) {
  setters.setIsVerified(status.verified);
  setters.setRequiresOnboarding(status.requiresOnboarding);
  setters.setLockSeconds(status.locked && status.retryAfter ? status.retryAfter : 0);
}

export const PatientDobProvider = ({ children }: { children: ReactNode }) => {
  const { session, role } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const isPatient = role === "patient" && Boolean(session);

  const refreshStatus = useCallback(async () => {
    if (!isPatient) {
      setIsVerified(false);
      setRequiresOnboarding(false);
      setLockSeconds(0);
      setAttemptsLeft(null);
      return;
    }

    setIsLoading(true);
    try {
      const status = await getPatientDobStatus();
      applyStatus(status, {
        setIsVerified,
        setRequiresOnboarding,
        setLockSeconds,
      });
    } catch {
      setIsVerified(false);
    } finally {
      setIsLoading(false);
    }
  }, [isPatient]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, session?.access_token]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          void refreshStatus();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds, refreshStatus]);

  const verify = useCallback(async (dateOfBirth: string) => {
    try {
      await verifyPatientDob(dateOfBirth);
      setIsVerified(true);
      setRequiresOnboarding(false);
      setLockSeconds(0);
      setAttemptsLeft(null);
    } catch (err) {
      const parsed = parsePatientDobError(err);
      if (parsed.retryAfterSeconds) {
        setLockSeconds(parsed.retryAfterSeconds);
      }
      if (parsed.attemptsLeft != null) {
        setAttemptsLeft(parsed.attemptsLeft);
      }
      if (parsed.code === "ONBOARDING_REQUIRED") {
        setRequiresOnboarding(true);
      }
      throw parsed;
    }
  }, []);

  const value = useMemo(
    () => ({
      isVerified,
      isLoading,
      requiresOnboarding,
      lockSeconds,
      attemptsLeft,
      refreshStatus,
      verify,
    }),
    [
      isVerified,
      isLoading,
      requiresOnboarding,
      lockSeconds,
      attemptsLeft,
      refreshStatus,
      verify,
    ],
  );

  return (
    <PatientDobContext.Provider value={value}>
      {children}
    </PatientDobContext.Provider>
  );
};

export const usePatientDobVerification = () => {
  const context = useContext(PatientDobContext);
  if (!context) {
    throw new Error("usePatientDobVerification must be used within PatientDobProvider.");
  }
  return context;
};
