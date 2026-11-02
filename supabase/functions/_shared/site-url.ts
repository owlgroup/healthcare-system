/** Public app origin for links in emails (no trailing slash). Set SITE_URL in supabase/functions/.env or Supabase secrets. */
const PRODUCTION_DEFAULT = "https://healthcare-system-ns.vercel.app";

function isLocalOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

function normalizeOrigin(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\/$/, "");
  if (isLocalOrigin(normalized)) return undefined;
  return normalized;
}

export function getSiteUrl(): string {
  // Do not use SUPABASE_SITE_URL — that is Auth redirect config (often localhost in dev).
  return (
    normalizeOrigin(Deno.env.get("SITE_URL")) ??
    normalizeOrigin(Deno.env.get("VITE_SITE_URL")) ??
    PRODUCTION_DEFAULT
  );
}
