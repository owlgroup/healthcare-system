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
  retryAfterSeconds?: number;
  attemptsLeft?: number;
  rules?: string[];
};

export class ResetApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error ?? "Request failed");
    this.status = status;
    this.code = body.error ?? body.code;
    this.retryAfterSeconds = body.retryAfter ?? body.retryAfterSeconds;
    this.attemptsLeft = body.attemptsLeft;
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
    throw new ResetApiError(0, {
      error: "NETWORK_ERROR",
      message: "Không kết nối được máy chủ. Chạy npm run supabase:deploy-functions",
    });
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!res.ok) {
    throw new ResetApiError(res.status, body);
  }
  return body as T;
}

export type SendResetOtpResult = {
  message: string;
  expiresIn: number;
};

/** AC1: luôn nhận message chung (edge không lộ email không tồn tại) */
export async function requestResetOtp(email: string) {
  return postJson<SendResetOtpResult>("forgot-password-send-otp", { email });
}

export type VerifyResetOtpResult = {
  message: string;
  reset_token: string;
  expiresIn: number;
};

/** AC2: OTP đúng → reset_token */
export async function verifyResetOtp(email: string, otp: string) {
  return postJson<VerifyResetOtpResult>("forgot-password-verify-otp", {
    email,
    otp,
  });
}

/** AC3–AC5: đặt mật khẩu mới, revoke sessions, audit */
export async function completePasswordReset(
  resetToken: string,
  password: string,
) {
  return postJson<{ message: string }>("reset-password-complete", {
    reset_token: resetToken,
    password,
  });
}
