import { portalLogout } from "@/lib/portal-auth-api";
import { supabase } from "@/lib/supabase";

let isClearingSession = false;

/** Acquire exclusive lock for session clearing; returns false if already clearing. */
export function acquireSessionClearLock(): boolean {
  if (isClearingSession) return false;
  isClearingSession = true;
  return true;
}

/** Xóa token Supabase trong localStorage + signOut local */
export async function clearAuthStorage(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* best-effort */
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("sb-") || key.includes("supabase.auth"))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url) {
    try {
      const ref = new URL(url).hostname.split(".")[0];
      localStorage.removeItem(`sb-${ref}-auth-token`);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Token hết hạn / không hợp lệ: xóa session và về /login để đăng nhập lại.
 */
export async function clearAuthAndRedirectHome(): Promise<never> {
  const { forceAuthLogout } = await import("@/lib/auth-refresh");
  return forceAuthLogout();
}

export function isUnauthorizedError(
  status: number,
  code?: string,
): boolean {
  return status === 401 || code === "UNAUTHORIZED";
}

/** Đăng xuất: revoke session + xóa token local → trang chủ */
export async function logoutAndRedirectTo(landingPath = "/"): Promise<void> {
  if (!acquireSessionClearLock()) return;
  try {
    await portalLogout();
  } catch {
    /* vẫn xóa local */
  }
  await clearAuthStorage();
  window.location.replace(landingPath);
}
