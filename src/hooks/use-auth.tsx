import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSessionNearExpiry, refreshSessionOnce } from "@/lib/auth-refresh";
import { getSessionRole } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import type { PortalType } from "@/types/portal";

type AuthContextValue = {
  session: Session | null;
  role: PortalType | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      let nextSession = data.session;
      if (isSessionNearExpiry(nextSession)) {
        nextSession = await refreshSessionOnce();
      }

      setSession(nextSession);
      setIsLoading(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      if (event === "TOKEN_REFRESHED" && nextSession) {
        /* JWT user_role claim updated from custom_access_token_hook */
      }
    });

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth.getSession().then(({ data }) => {
        if (isSessionNearExpiry(data.session, 120)) {
          void refreshSessionOnce().then((refreshed) => {
            if (refreshed) setSession(refreshed);
          });
        }
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const role = useMemo(() => getSessionRole(session), [session]);

  const value = useMemo(
    () => ({
      session,
      role,
      isLoading,
    }),
    [session, role, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
};
