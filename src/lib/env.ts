/**
 * Runtime-aware env reader.
 *
 * Production (Docker/Nginx): values come from `window.__ENV__`, written to
 * `/env-config.js` by `docker/env-config.sh` when the container starts, so the
 * image is built WITHOUT any .env and configured via container env (Portainer).
 *
 * Local dev / tests: `window.__ENV__` is empty, so it falls back to Vite's
 * build-time `import.meta.env` (read from your local .env).
 */
type RuntimeEnv = Partial<Record<string, string>>;

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

export function getEnv(key: `VITE_${string}`): string | undefined {
  const runtime = typeof window !== "undefined" ? window.__ENV__?.[key] : undefined;
  if (typeof runtime === "string" && runtime.trim() !== "") return runtime;

  const buildTime = ((import.meta.env ?? {}) as Record<string, unknown>)[key];
  return typeof buildTime === "string" && buildTime !== "" ? buildTime : undefined;
}
