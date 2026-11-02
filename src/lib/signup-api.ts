import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  code?: string;
  hint?: string;
  retryAfter?: number;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
  attemptsRemaining?: number;
  suggestions?: string[];
  rules?: string[] | Record<string, boolean>;
};

export class SignupApiError extends Error {
  status: number;
  code?: string;
  hint?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
  suggestions?: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error ?? "Request failed");
    this.status = status;
    this.code = body.error ?? body.code;
    this.hint = body.hint;
    this.retryAfterSeconds = body.retryAfter ?? body.retryAfterSeconds;
    this.attemptsLeft = body.attemptsLeft ?? body.attemptsRemaining;
    this.suggestions = body.suggestions;
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
    throw new SignupApiError(0, {
      error: "NETWORK_ERROR",
      message:
        "Không kết nối được máy chủ đăng ký. Chạy npm run supabase:deploy-functions",
    });
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!res.ok) {
    throw new SignupApiError(res.status, body);
  }
  return body as T;
}

export type SendOtpResult = {
  message: string;
  expiresIn: number;
};

/**
 * 1) Edge: kiểm tra email / khóa
 * 2) Client: supabase.auth.signInWithOtp({ email }) — Supabase gửi OTP 6 số
 */
export async function requestSignupOtp(email: string): Promise<SendOtpResult> {
  const check = await postJson<SendOtpResult>("signup-send-otp", { email });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      throw new SignupApiError(409, {
        error: "EMAIL_EXISTS",
        message: "Tài khoản đã tồn tại",
        suggestions: ["login", "forgot_password"],
      });
    }
    throw new SignupApiError(500, {
      error: "SEND_FAILED",
      message:
        "Không gửi được OTP. Dashboard: Authentication → Email → bật Email OTP, tắt Confirm email.",
    });
  }

  return {
    message: check.message ?? "OTP đã gửi",
    expiresIn: check.expiresIn ?? 300,
  };
}

export type SignupSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
};

export type VerifyOtpResult = {
  message: string;
  session: SignupSession;
  needsPassword: boolean;
};

/**
 * Xác minh OTP — ưu tiên supabase-js verifyOtp, edge khi cần mã lỗi / khóa.
 */
export async function verifySignupOtp(
  email: string,
  otp: string,
): Promise<VerifyOtpResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (!error && data.session) {
    return {
      message: "Xác minh OTP thành công",
      needsPassword: true,
      session: sessionToSignupSession(data.session),
    };
  }

  try {
    return await postJson<VerifyOtpResult>("signup-verify-otp", { email, otp });
  } catch (edgeErr) {
    if (edgeErr instanceof SignupApiError) throw edgeErr;
    throw new SignupApiError(400, {
      error: "INVALID_OTP",
      message: error?.message ?? "OTP không đúng",
    });
  }
}

export function sessionToSignupSession(session: Session): SignupSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in ?? 3600,
    expires_at: session.expires_at,
    token_type: session.token_type ?? "bearer",
  };
}

/** Đặt mật khẩu sau verify OTP. */
export async function completeSignup(session: SignupSession, password: string) {
  const result = await postJson<{
    user: { id: string; email: string };
    session: SignupSession;
  }>("signup-complete", {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    password,
  });

  return result;
}

export async function applySignupSession(session: SignupSession) {
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
}
