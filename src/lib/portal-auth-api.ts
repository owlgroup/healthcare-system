import { supabase } from "@/lib/supabase";
import type { PortalType } from "@/types/portal";

const functionsBase = () => {
  const override = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (override) return override.replace(/\/$/, "");

  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("VITE_SUPABASE_URL is not configured");
  return `${url.replace(/\/$/, "")}/functions/v1`;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  retryAfter?: number;
  attemptsLeft?: number;
  userRole?: string;
};

export class PortalAuthError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
  userRole?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error ?? "Request failed");
    this.status = status;
    this.code = body.error;
    this.retryAfterSeconds = body.retryAfter;
    this.attemptsLeft = body.attemptsLeft;
    this.userRole = body.userRole;
  }
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${functionsBase()}/${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new PortalAuthError(0, {
      error: "NETWORK_ERROR",
      message: "Không kết nối được máy chủ đăng nhập",
    });
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!res.ok) {
    throw new PortalAuthError(res.status, body);
  }
  return body as T;
}

export type PortalSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
};

export type PortalLoginResult = {
  message: string;
  portal: PortalType;
  role: PortalType;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  session: PortalSession;
};

export type AdminMfaRequired = {
  requiresMfa: true;
  mfaToken: string;
  expiresIn: number;
  message: string;
};

export type PatientDobRequired = {
  requiresDob: true;
  message: string;
};

export type LoginResponse = PortalLoginResult | AdminMfaRequired | PatientDobRequired;

async function applyLoginSession(result: PortalLoginResult): Promise<PortalLoginResult> {
  const { error } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });
  if (error) throw new PortalAuthError(500, { message: error.message });
  await supabase.auth.refreshSession();
  return result;
}

/** Đăng nhập một cổng — redirect theo role trong user_profiles */
export async function unifiedLogin(
  email: string,
  password: string,
  dateOfBirth?: string,
): Promise<LoginResponse> {
  const result = await postJson<LoginResponse>("portal-login", {
    email,
    password,
    portal: "auto",
    ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
  });
  if ("requiresMfa" in result && result.requiresMfa) {
    return result;
  }
  if ("requiresDob" in result && result.requiresDob) {
    return result;
  }
  return applyLoginSession(result as PortalLoginResult);
}

/** @deprecated Gọi unifiedLogin(email, password, dateOfBirth) thay thế */
export async function verifyPatientDobLogin(
  _dobToken: string,
  dateOfBirth: string,
  email?: string,
  password?: string,
): Promise<PortalLoginResult> {
  if (!email || !password) {
    throw new PortalAuthError(422, {
      error: "MISSING_CREDENTIALS",
      message: "Vui lòng đăng nhập lại",
    });
  }
  const result = await unifiedLogin(email, password, dateOfBirth);
  if ("requiresDob" in result || "requiresMfa" in result) {
    throw new PortalAuthError(500, { message: "Xác thực thất bại" });
  }
  return result;
}

export async function verifyAdminMfa(
  mfaToken: string,
  otp: string,
): Promise<PortalLoginResult> {
  const result = await postJson<PortalLoginResult>("admin-mfa-verify", {
    mfaToken,
    otp,
  });
  return applyLoginSession(result);
}

/** @deprecated Dùng unifiedLogin — giữ cho tương thích */
export async function portalLogin(
  portal: PortalType,
  email: string,
  password: string,
): Promise<PortalLoginResult> {
  const result = await postJson<PortalLoginResult>("portal-login", {
    email,
    password,
    portal,
  });
  return applyLoginSession(result);
}

export async function portalLogout(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session) {
    try {
      await postJson("portal-logout", {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } catch {
      /* still sign out locally */
    }
  }

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
