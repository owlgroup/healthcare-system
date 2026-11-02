import { fetchWithAuthRetry, forceAuthLogout, getAccessTokenOrRefresh } from "@/lib/auth-refresh";

function functionsBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error("VITE_SUPABASE_URL is not configured");
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAccessTokenOrRefresh();
  if (!token) {
    await forceAuthLogout();
  }

  const res = await fetchWithAuthRetry(`${functionsBaseUrl()}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? "Request failed");
  }
  return json;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await invokeFunction<{ message: string }>("patient-change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function enrollPatientMfa(email: string): Promise<{ expiresIn: number }> {
  return invokeFunction<{ expiresIn: number }>("patient-mfa-enroll", { email });
}

export async function verifyPatientMfa(email: string, otp: string): Promise<void> {
  await invokeFunction<{ message: string }>("patient-mfa-verify", { email, otp });
}
