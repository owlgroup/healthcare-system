/**
 * Profile OTP API - Send and verify OTP for unlocking sensitive profile data
 */

import { fetchWithAuthRetry, getAccessTokenOrRefresh } from '@/lib/auth-refresh';

function functionsBaseUrl(): string {
  const override = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (override) return (override as string).replace(/\/$/, '');

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error('VITE_SUPABASE_URL is not configured');
  return `${url.replace(/\/$/, '')}/functions/v1`;
}

export class ProfileOtpError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;

  constructor(
    status: number,
    body: { error?: string; message?: string; retryAfterSeconds?: number; attemptsLeft?: number },
  ) {
    super(body.message ?? body.error ?? 'Request failed');
    this.status = status;
    this.code = body.error;
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.attemptsLeft = body.attemptsLeft;
  }
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAccessTokenOrRefresh();
  if (!token) {
    throw new ProfileOtpError(401, { error: 'UNAUTHORIZED', message: 'Phiên đăng nhập hết hạn' });
  }

  let res: Response;
  try {
    res = await fetchWithAuthRetry(`${functionsBaseUrl()}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ProfileOtpError(0, {
      error: 'NETWORK_ERROR',
      message: 'Không kết nối được máy chủ',
    });
  }

  const json = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
    retryAfterSeconds?: number;
    attemptsLeft?: number;
  };

  if (!res.ok) {
    throw new ProfileOtpError(res.status, json);
  }
  return json;
}

export type SendProfileOtpResult = {
  message: string;
  expiresIn: number;
};

export type VerifyProfileOtpResult = {
  message: string;
  unlockToken: string;
  expiresIn: number;
};

/**
 * Send OTP to user's email for profile unlock
 */
export async function sendProfileOtp(email: string): Promise<SendProfileOtpResult> {
  return invokeFunction<SendProfileOtpResult>('profile-send-otp', { email });
}

/**
 * Verify OTP and get unlock token
 */
export async function verifyProfileOtp(email: string, otp: string): Promise<VerifyProfileOtpResult> {
  return invokeFunction<VerifyProfileOtpResult>('profile-verify-otp', { email, otp });
}
