import type { Session } from "@supabase/supabase-js";
import {
  isPortalType,
  type PortalType,
  PORTAL_CONFIG,
} from "@/types/portal";

export function getSessionRole(session: Session | null): PortalType | null {
  if (!session) return null;

  try {
    const payload = JSON.parse(
      atob(session.access_token.split(".")[1] ?? ""),
    ) as { user_role?: string };
    if (payload.user_role && isPortalType(payload.user_role)) {
      return payload.user_role;
    }
  } catch {
    /* ignore */
  }

  const appRole = session.user.app_metadata?.role;
  if (typeof appRole === "string" && isPortalType(appRole)) {
    return appRole;
  }

  return null;
}

export function homePathForRole(role: PortalType | null): string {
  if (role && PORTAL_CONFIG[role]) return PORTAL_CONFIG[role].homePath;
  return PORTAL_CONFIG.patient.homePath;
}

export function loginPathForPortal(portal: PortalType): string {
  return PORTAL_CONFIG[portal].loginPath;
}

export function loginPathForRole(role: PortalType | null): string {
  if (role && PORTAL_CONFIG[role]) return PORTAL_CONFIG[role].loginPath;
  return PORTAL_CONFIG.patient.loginPath;
}

const AUTH_RETURN_KEY = "auth_return_to";
export const DOB_RETURN_KEY = "dob_return_to";
export const VERIFY_DOB_PATH = "/verify-dob";

/** Persist intended destination when redirecting unauthenticated users to login. */
export function stashAuthReturnTo(path: string): void {
  if (!path || path.startsWith("/login")) return;
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, path);
  } catch {
    /* ignore */
  }
}

function isSafeReturnPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login");
}

function isPathAllowedForRole(path: string, role: PortalType): boolean {
  if (role === "admin") return path.startsWith("/admin");
  if (role === "doctor") return path.startsWith("/provider-portal");
  if (role === "customer") return path.startsWith("/customer-portal");
  return !path.startsWith("/admin") && !path.startsWith("/provider-portal") && !path.startsWith("/customer-portal");
}

/** After login, return to the page the user originally requested when safe. */
export function resolvePostLoginPath(
  role: PortalType,
  from?: { pathname: string; search?: string; hash?: string } | null,
): string {
  const fallback = PORTAL_CONFIG[role].homePath;

  const fromPath = from?.pathname
    ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
    : null;

  let stashed: string | null = null;
  try {
    stashed = sessionStorage.getItem(AUTH_RETURN_KEY);
  } catch {
    /* ignore */
  }

  const target = fromPath ?? stashed;
  if (!target || !isSafeReturnPath(target) || !isPathAllowedForRole(target, role)) {
    return fallback;
  }

  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    /* ignore */
  }

  return target;
}

export function stashDobReturnTo(path: string): void {
  if (!path || path === VERIFY_DOB_PATH || path.startsWith("/login")) return;
  try {
    sessionStorage.setItem(DOB_RETURN_KEY, path);
  } catch {
    /* ignore */
  }
}

export function peekDobReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(DOB_RETURN_KEY);
    return value && isSafeReturnPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function consumeDobReturnTo(fallback = PORTAL_CONFIG.patient.homePath): string {
  const value = peekDobReturnTo();
  try {
    sessionStorage.removeItem(DOB_RETURN_KEY);
  } catch {
    /* ignore */
  }
  return value ?? fallback;
}

/** Patient must verify DOB before entering the portal; stash intended destination first. */
export function resolvePostLoginPathForPatient(
  from?: { pathname: string; search?: string; hash?: string } | null,
): string {
  const destination = resolvePostLoginPath("patient", from);
  if (destination !== VERIFY_DOB_PATH) {
    stashDobReturnTo(destination);
  }
  return VERIFY_DOB_PATH;
}
