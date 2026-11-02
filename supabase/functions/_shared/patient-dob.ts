import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  DOB_LOCK_TTL_SECONDS,
  DOB_VERIFIED_TTL_SECONDS,
  dobAttemptKey,
  dobLockKey,
  dobVerifiedKey,
  getRedis,
  MAX_DOB_ATTEMPTS,
} from "./redis.ts";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/** Normalize Postgres date / ISO strings to YYYY-MM-DD for safe comparison */
export function normalizeDobValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function dobValuesMatch(stored: unknown, submitted: string): boolean {
  const storedNorm = normalizeDobValue(stored);
  const submittedNorm = normalizeDobValue(submitted);
  return Boolean(storedNorm && submittedNorm && storedNorm === submittedNorm);
}

export type PatientDobRecord = {
  date_of_birth: string | null;
};

export async function fetchPatientDob(
  admin: SupabaseClient,
  userId: string,
): Promise<PatientDobRecord | null> {
  const { data, error } = await admin
    .from("patient")
    .select("date_of_birth")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[patient-dob] fetch patient", error.message);
    return null;
  }

  return data;
}

export type DobStatusResult = {
  verified: boolean;
  locked: boolean;
  retryAfter: number | null;
  requiresOnboarding: boolean;
};

export async function getPatientDobStatus(
  admin: SupabaseClient,
  userId: string,
): Promise<DobStatusResult> {
  const redis = getRedis();
  const patient = await fetchPatientDob(admin, userId);

  if (!patient?.date_of_birth) {
    return {
      verified: false,
      locked: false,
      retryAfter: null,
      requiresOnboarding: true,
    };
  }

  const lock = await redis.get(dobLockKey(userId));
  if (lock) {
    const retryAfter = await redis.ttl(dobLockKey(userId));
    return {
      verified: false,
      locked: true,
      retryAfter: retryAfter > 0 ? retryAfter : DOB_LOCK_TTL_SECONDS,
      requiresOnboarding: false,
    };
  }

  const verified = await redis.get(dobVerifiedKey(userId));
  return {
    verified: verified === "1",
    locked: false,
    retryAfter: null,
    requiresOnboarding: false,
  };
}

export type DobVerifyResult =
  | { ok: true }
  | {
    ok: false;
    error: string;
    message: string;
    status: number;
    attemptsLeft?: number;
    retryAfter?: number;
  };

export async function verifyPatientDob(
  admin: SupabaseClient,
  userId: string,
  submittedDob: string,
): Promise<DobVerifyResult> {
  if (!isValidIsoDate(submittedDob)) {
    return {
      ok: false,
      error: "INVALID_DOB",
      message: "Vui lòng nhập ngày sinh hợp lệ",
      status: 422,
    };
  }

  const redis = getRedis();
  const lock = await redis.get(dobLockKey(userId));
  if (lock) {
    const retryAfter = await redis.ttl(dobLockKey(userId));
    return {
      ok: false,
      error: "DOB_LOCKED",
      message: "Tạm khóa do nhập sai quá nhiều lần",
      status: 429,
      retryAfter: retryAfter > 0 ? retryAfter : DOB_LOCK_TTL_SECONDS,
    };
  }

  const patient = await fetchPatientDob(admin, userId);
  if (!patient?.date_of_birth) {
    return {
      ok: false,
      error: "ONBOARDING_REQUIRED",
      message: "Vui lòng hoàn tất hồ sơ trước khi xác thực",
      status: 422,
    };
  }

  if (!dobValuesMatch(patient.date_of_birth, submittedDob)) {
    const attempts = await redis.incr(dobAttemptKey(userId));
    if (attempts === 1) {
      await redis.expire(dobAttemptKey(userId), DOB_LOCK_TTL_SECONDS);
    }

    const attemptsLeft = Math.max(0, MAX_DOB_ATTEMPTS - attempts);

    if (attempts >= MAX_DOB_ATTEMPTS) {
      await redis.set(dobLockKey(userId), "1", { ex: DOB_LOCK_TTL_SECONDS });
      await redis.del(dobAttemptKey(userId));
      return {
        ok: false,
        error: "DOB_LOCKED",
        message: "Tạm khóa do nhập sai quá nhiều lần",
        status: 429,
        retryAfter: DOB_LOCK_TTL_SECONDS,
      };
    }

    return {
      ok: false,
      error: "DOB_MISMATCH",
      message: "Ngày sinh không khớp với hồ sơ. Vui lòng thử lại.",
      status: 401,
      attemptsLeft,
    };
  }

  await redis.set(dobVerifiedKey(userId), "1", { ex: DOB_VERIFIED_TTL_SECONDS });
  await redis.del(dobAttemptKey(userId));
  return { ok: true };
}
