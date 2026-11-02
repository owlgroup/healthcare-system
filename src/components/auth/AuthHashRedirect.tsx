import { useEffect } from "react";
import { hasAuthCallbackParams } from "@/lib/auth-hash-errors";

/** Send auth hash/query params on landing pages to the set-password handler. */
export default function AuthHashRedirect() {
  useEffect(() => {
    const { pathname, hash, search } = window.location;
    if (pathname === "/auth/set-password" || pathname === "/auth/callback") return;
    if (!hasAuthCallbackParams(hash, search)) return;

    const target = `/auth/set-password${search}${hash}`;
    window.location.replace(target);
  }, []);

  return null;
}
