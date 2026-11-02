import type { Session } from "@supabase/supabase-js";
import { acquireSessionClearLock, clearAuthStorage } from "@/lib/auth-session";
import { stashAuthReturnTo } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

export const AUTH_SESSION_EXPIRED_KEY = "auth_session_expired";
export const DEFAULT_SESSION_EXPIRED_MESSAGE =
  "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

let refreshPromise: Promise<Session | null> | null = null;

/** Deduplicated refresh — concurrent callers share one in-flight request. */
export async function refreshSessionOnce(): Promise<Session | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return null;
      return data.session;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function forceAuthLogout(
  message = DEFAULT_SESSION_EXPIRED_MESSAGE,
): Promise<never> {
  if (!acquireSessionClearLock()) {
    return new Promise(() => {
      /* redirect already in progress */
    }) as never;
  }

  try {
    stashAuthReturnTo(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    sessionStorage.setItem(AUTH_SESSION_EXPIRED_KEY, message);
  } catch {
    /* best-effort */
  }

  await clearAuthStorage();
  window.location.replace("/login");

  return new Promise(() => {
    /* redirect in progress */
  }) as never;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function shouldHandle401(url: string): boolean {
  if (url.includes("/auth/v1/")) return false;
  return url.includes("/rest/v1/") || url.includes("/functions/v1/");
}

function withBearerToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** Retry a fetch once with a fresh access token. */
export function retryFetchWithFreshToken(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  token: string,
): Promise<Response> {
  if (input instanceof Request) {
    const headers = new Headers(input.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return globalThis.fetch(input.url, {
      method: input.method,
      headers,
      body: input.body,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      referrer: input.referrer,
      integrity: input.integrity,
      signal: input.signal,
      ...init,
    });
  }

  return globalThis.fetch(input, withBearerToken(init, token));
}

/** Handle 401 from PostgREST / edge functions: refresh → retry once → logout if refresh fails. */
export async function handleUnauthorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  response: Response,
): Promise<Response> {
  const url = getRequestUrl(input);
  if (response.status !== 401 || !shouldHandle401(url)) {
    return response;
  }

  const session = await refreshSessionOnce();
  if (!session) {
    void forceAuthLogout();
    return response;
  }

  return retryFetchWithFreshToken(input, init, session.access_token);
}

/** Return a valid access token, proactively refreshing when near expiry. */
export async function getAccessTokenOrRefresh(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  if (!isSessionNearExpiry(session)) {
    return session.access_token;
  }

  const refreshed = await refreshSessionOnce();
  return refreshed?.access_token ?? null;
}

export function isSessionNearExpiry(session: Session | null, thresholdSeconds = 60): boolean {
  if (!session?.expires_at) return false;
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at - now < thresholdSeconds;
}

/** Fetch helper for API clients using raw fetch (admin-api, patient-password-api). */
export async function fetchWithAuthRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const token = await getAccessTokenOrRefresh();
  if (!token) {
    await forceAuthLogout();
  }

  const buildInit = (accessToken: string): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let response = await globalThis.fetch(url, buildInit(token));

  if (response.status === 401) {
    const session = await refreshSessionOnce();
    if (!session) {
      await forceAuthLogout();
    }
    response = await globalThis.fetch(url, buildInit(session.access_token));
  }

  return response;
}
