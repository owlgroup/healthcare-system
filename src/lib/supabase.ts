import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
  );
}

// Intercept 401s on protected endpoints: refresh token → retry once → logout only if refresh fails.
// Auth-endpoint 401s (/auth/v1/) are excluded to avoid refresh loops.
const fetchWithAuthGuard: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await globalThis.fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  const { handleUnauthorizedFetch, shouldHandle401 } = await import("@/lib/auth-refresh");
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!shouldHandle401(url)) {
    return response;
  }

  return handleUnauthorizedFetch(input, init, response);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithAuthGuard },
});
