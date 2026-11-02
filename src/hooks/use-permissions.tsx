import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMyPermissions } from "@/lib/admin-api";
import { useAuth } from "@/hooks/use-auth";

type PermissionsContextValue = {
  permissions: Set<string>;
  hasPermission: (slug: string | string[]) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { session, role } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session || role !== "customer") {
      setPermissions(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetchMyPermissions();
      setPermissions(new Set(res.permissions));
    } catch {
      setPermissions(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [session, role]);

  useEffect(() => {
    void load();
  }, [load, session?.access_token]);

  const hasPermission = useCallback(
    (slug: string | string[]) => {
      const slugs = Array.isArray(slug) ? slug : [slug];
      return slugs.some((s) => permissions.has(s));
    },
    [permissions],
  );

  const value = useMemo(
    () => ({ permissions, hasPermission, isLoading, refresh: load }),
    [permissions, hasPermission, isLoading, load],
  );

  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionsProvider.");
  }
  return context;
};

/** Safe variant for components that may render outside staff portals. */
export const usePermissionsOptional = () => useContext(PermissionsContext);
