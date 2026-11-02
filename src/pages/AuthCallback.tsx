import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const goToPasswordStep = (email?: string | null) => {
      if (cancelled) return;
      navigate("/signup", {
        replace: true,
        state: { step: "password" as const, email: email ?? undefined },
      });
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        nextSession &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
      ) {
        goToPasswordStep(nextSession.user.email);
      }
    });

    const run = async () => {
      await new Promise((r) => window.setTimeout(r, 150));
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (data.session) {
        goToPasswordStep(data.session.user.email);
        return;
      }

      window.setTimeout(async () => {
        if (cancelled) return;
        const retry = await supabase.auth.getSession();
        if (retry.data.session) {
          goToPasswordStep(retry.data.session.user.email);
        } else {
          setErrorMessage(
            "Không nhận được phiên đăng nhập. Mở lại link trong email hoặc đăng ký lại.",
          );
        }
      }, 3000);
    };

    void run();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (errorMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="max-w-md text-center text-sm text-destructive">{errorMessage}</p>
        <Link to="/signup" className="text-sm font-semibold text-primary underline">
          Quay lại đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Đang xác nhận email...</p>
    </div>
  );
};

export default AuthCallback;
