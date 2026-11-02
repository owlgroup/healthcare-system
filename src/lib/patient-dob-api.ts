import { supabase } from "@/lib/supabase";

type ApiErrorBody = {
  error?: string;
  message?: string;
  retryAfter?: number;
  attemptsLeft?: number;
};

export class PatientDobError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error ?? "Request failed");
    this.status = status;
    this.code = body.error;
    this.retryAfterSeconds = body.retryAfter;
    this.attemptsLeft = body.attemptsLeft;
  }
}

function parseInvokeError(
  fnName: string,
  error: { message?: string; context?: { status?: number; body?: unknown } },
): PatientDobError {
  const status = error.context?.status ?? 0;
  const rawBody = error.context?.body;
  const body = (typeof rawBody === "object" && rawBody !== null
    ? rawBody
    : {}) as ApiErrorBody;

  if (status === 404 || /not found|404/i.test(error.message ?? "")) {
    return new PatientDobError(404, {
      error: "FUNCTION_NOT_DEPLOYED",
      message:
        "Chức năng xác thực ngày sinh chưa được triển khai. Chạy: npm run supabase:deploy-functions",
    });
  }

  if (status === 0 || /fetch|network|failed to send/i.test(error.message ?? "")) {
    return new PatientDobError(0, {
      error: "NETWORK_ERROR",
      message:
        "Không kết nối được máy chủ. Kiểm tra mạng hoặc chạy npm run supabase:deploy-functions",
    });
  }

  return new PatientDobError(status || 500, {
    error: body.error ?? "INVOKE_FAILED",
    message: body.message ?? error.message ?? `Gọi ${fnName} thất bại`,
    retryAfter: body.retryAfter,
    attemptsLeft: body.attemptsLeft,
  });
}

async function invokePatientDob<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new PatientDobError(401, {
      error: "UNAUTHORIZED",
      message: "Phiên đăng nhập đã hết hạn",
    });
  }

  const { data, error } = await supabase.functions.invoke(fnName, {
    body: body ?? {},
  });

  if (error) {
    throw parseInvokeError(fnName, error);
  }

  const payload = data as (ApiErrorBody & T) | null;
  if (payload?.error) {
    throw new PatientDobError(400, payload);
  }

  return payload as T;
}

export type PatientDobStatus = {
  verified: boolean;
  locked: boolean;
  retryAfter: number | null;
  requiresOnboarding: boolean;
};

export async function getPatientDobStatus(): Promise<PatientDobStatus> {
  return invokePatientDob<PatientDobStatus>("patient-dob-status");
}

export async function verifyPatientDob(
  dateOfBirth: string,
): Promise<{ message: string; verified: boolean }> {
  return invokePatientDob("patient-dob-verify", { date_of_birth: dateOfBirth });
}

export function parsePatientDobError(err: unknown): PatientDobError {
  if (err instanceof PatientDobError) return err;
  return new PatientDobError(500, {
    error: "UNKNOWN",
    message: err instanceof Error ? err.message : "Xác thực thất bại",
  });
}
