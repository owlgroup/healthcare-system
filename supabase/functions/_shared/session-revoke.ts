/** Best-effort revoke of a Supabase auth session */
export async function revokeSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return;

  try {
    await fetch(`${url}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    /* best-effort */
  }
}
