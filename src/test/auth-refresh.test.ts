import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const mockRefreshSession = vi.fn();
const mockGetSession = vi.fn();
const mockClearAuthStorage = vi.fn();
const mockAcquireSessionClearLock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/lib/auth-session", () => ({
  clearAuthStorage: (...args: unknown[]) => mockClearAuthStorage(...args),
  acquireSessionClearLock: (...args: unknown[]) => mockAcquireSessionClearLock(...args),
}));

vi.mock("@/lib/portal-auth", () => ({
  stashAuthReturnTo: vi.fn(),
}));

function makeSession(expiresInSeconds: number): Session {
  const expires_at = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: expiresInSeconds,
    expires_at,
    token_type: "bearer",
    user: { id: "user-1" } as Session["user"],
  };
}

describe("auth-refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRefreshSession.mockReset();
    mockGetSession.mockReset();
    mockClearAuthStorage.mockReset();
    mockAcquireSessionClearLock.mockReset();
    mockAcquireSessionClearLock.mockReturnValue(true);
    mockClearAuthStorage.mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("refreshSessionOnce", () => {
    it("dedupes concurrent refresh calls", async () => {
      let resolveRefresh!: (value: { data: { session: Session }; error: null }) => void;
      mockRefreshSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

      const { refreshSessionOnce } = await import("@/lib/auth-refresh");
      const session = makeSession(3600);

      const p1 = refreshSessionOnce();
      const p2 = refreshSessionOnce();
      const p3 = refreshSessionOnce();

      resolveRefresh({ data: { session }, error: null });

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      expect(r1?.access_token).toBe("access-token");
      expect(r2?.access_token).toBe("access-token");
      expect(r3?.access_token).toBe("access-token");
    });

    it("returns null when refresh fails", async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "invalid refresh token" },
      });

      const { refreshSessionOnce } = await import("@/lib/auth-refresh");
      const result = await refreshSessionOnce();
      expect(result).toBeNull();
    });
  });

  describe("isSessionNearExpiry", () => {
    it("returns true when token expires within threshold", async () => {
      const { isSessionNearExpiry } = await import("@/lib/auth-refresh");
      expect(isSessionNearExpiry(makeSession(30), 60)).toBe(true);
      expect(isSessionNearExpiry(makeSession(120), 60)).toBe(false);
      expect(isSessionNearExpiry(null)).toBe(false);
    });
  });

  describe("getAccessTokenOrRefresh", () => {
    it("returns current token when not near expiry", async () => {
      mockGetSession.mockResolvedValue({ data: { session: makeSession(3600) } });

      const { getAccessTokenOrRefresh } = await import("@/lib/auth-refresh");
      const token = await getAccessTokenOrRefresh();
      expect(token).toBe("access-token");
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    it("refreshes when token is near expiry", async () => {
      mockGetSession.mockResolvedValue({ data: { session: makeSession(30) } });
      mockRefreshSession.mockResolvedValue({
        data: { session: makeSession(3600) },
        error: null,
      });

      const { getAccessTokenOrRefresh } = await import("@/lib/auth-refresh");
      const token = await getAccessTokenOrRefresh();
      expect(token).toBe("access-token");
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("shouldHandle401", () => {
    it("handles PostgREST and edge functions but not auth endpoints", async () => {
      const { shouldHandle401 } = await import("@/lib/auth-refresh");
      expect(shouldHandle401("https://x.supabase.co/rest/v1/users")).toBe(true);
      expect(shouldHandle401("https://x.supabase.co/functions/v1/admin-users")).toBe(true);
      expect(shouldHandle401("https://x.supabase.co/auth/v1/token")).toBe(false);
    });
  });

  describe("handleUnauthorizedFetch", () => {
    it("retries with fresh token when refresh succeeds", async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: makeSession(3600) },
        error: null,
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const { handleUnauthorizedFetch } = await import("@/lib/auth-refresh");
      const initial = new Response(null, { status: 401 });
      const result = await handleUnauthorizedFetch(
        "https://x.supabase.co/rest/v1/users",
        { headers: { Authorization: "Bearer stale" } },
        initial,
      );

      expect(result.status).toBe(200);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it("does not logout when refresh succeeds but retry still returns 401", async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: makeSession(3600) },
        error: null,
      });

      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
      vi.stubGlobal("fetch", fetchMock);

      const replaceMock = vi.fn();
      vi.stubGlobal("location", { ...window.location, replace: replaceMock });

      const { handleUnauthorizedFetch } = await import("@/lib/auth-refresh");
      const initial = new Response(null, { status: 401 });
      const result = await handleUnauthorizedFetch(
        "https://x.supabase.co/rest/v1/users",
        undefined,
        initial,
      );

      expect(result.status).toBe(401);
      expect(replaceMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("triggers logout when refresh fails", async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "expired" },
      });

      const replaceMock = vi.fn();
      vi.stubGlobal("location", { ...window.location, replace: replaceMock });

      const { handleUnauthorizedFetch, AUTH_SESSION_EXPIRED_KEY } = await import(
        "@/lib/auth-refresh"
      );
      const initial = new Response(null, { status: 401 });
      await handleUnauthorizedFetch(
        "https://x.supabase.co/rest/v1/users",
        undefined,
        initial,
      );

      await vi.waitFor(() => {
        expect(mockClearAuthStorage).toHaveBeenCalled();
        expect(replaceMock).toHaveBeenCalledWith("/login");
        expect(sessionStorage.getItem(AUTH_SESSION_EXPIRED_KEY)).toBeTruthy();
      });

      vi.unstubAllGlobals();
    });
  });

  describe("forceAuthLogout", () => {
    it("only clears session once when called concurrently", async () => {
      mockAcquireSessionClearLock.mockReturnValueOnce(true).mockReturnValue(false);

      const replaceMock = vi.fn();
      vi.stubGlobal("location", { ...window.location, replace: replaceMock });

      const { forceAuthLogout, AUTH_SESSION_EXPIRED_KEY } = await import("@/lib/auth-refresh");

      void forceAuthLogout("Test message");
      void forceAuthLogout("Test message");

      await vi.waitFor(() => {
        expect(mockClearAuthStorage).toHaveBeenCalledTimes(1);
        expect(replaceMock).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem(AUTH_SESSION_EXPIRED_KEY)).toBe("Test message");
      });

      vi.unstubAllGlobals();
    });
  });

  describe("fetchWithAuthRetry", () => {
    it("retries once on 401 after successful refresh", async () => {
      mockGetSession.mockResolvedValue({ data: { session: makeSession(3600) } });
      mockRefreshSession.mockResolvedValue({
        data: { session: makeSession(3600) },
        error: null,
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const { fetchWithAuthRetry } = await import("@/lib/auth-refresh");
      const res = await fetchWithAuthRetry("https://x.supabase.co/functions/v1/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });
  });
});
