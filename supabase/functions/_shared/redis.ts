/** Redis via Upstash REST API (Edge-compatible). Falls back to in-memory when unset (local dev only). */

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
};

const memory = new Map<string, { value: string; expiresAt?: number }>();

function memoryRedis(): RedisLike {
  const purge = (key: string) => {
    const entry = memory.get(key);
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return entry?.value ?? null;
  };

  return {
    async get(key) {
      return purge(key);
    },
    async set(key, value, opts) {
      const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
      memory.set(key, { value, expiresAt });
    },
    async del(key) {
      memory.delete(key);
    },
    async incr(key) {
      const current = Number(purge(key) ?? "0");
      const next = current + 1;
      const entry = memory.get(key);
      memory.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt,
      });
      return next;
    },
    async expire(key, seconds) {
      const val = purge(key);
      if (val != null) {
        memory.set(key, { value: val, expiresAt: Date.now() + seconds * 1000 });
      }
    },
    async ttl(key) {
      const entry = memory.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
  };
}

function upstashRedis(): RedisLike {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? Deno.env.get("REDIS_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ??
    Deno.env.get("REDIS_TOKEN");

  if (!url || !token) {
    console.warn(
      "[signup] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory store (dev only)",
    );
    return memoryRedis();
  }

  const base = url.replace(/\/$/, "");

  async function command(...args: string[]): Promise<unknown> {
    const res = await fetch(`${base}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      throw new Error(`Redis error: ${res.status}`);
    }
    const data = await res.json() as { result: unknown };
    return data.result;
  }

  return {
    async get(key) {
      const result = await command("GET", key);
      return result == null ? null : String(result);
    },
    async set(key, value, opts) {
      if (opts?.ex) {
        await command("SET", key, value, "EX", String(opts.ex));
      } else {
        await command("SET", key, value);
      }
    },
    async del(key) {
      await command("DEL", key);
    },
    async incr(key) {
      const result = await command("INCR", key);
      return Number(result);
    },
    async expire(key, seconds) {
      await command("EXPIRE", key, String(seconds));
    },
    async ttl(key) {
      const result = await command("TTL", key);
      return Number(result);
    },
  };
}

let client: RedisLike | null = null;

export function getRedis(): RedisLike {
  if (!client) client = upstashRedis();
  return client;
}

export const OTP_TTL_SECONDS = 300;
export const LOCK_TTL_SECONDS = 300;
export const TEMP_TOKEN_TTL_SECONDS = 600;
export const MAX_OTP_ATTEMPTS = 3;

/** Spec: otp:hash:{email} */
export function otpHashKey(email: string) {
  return `otp:hash:${email}`;
}

/** Spec: otp:attempt:{email} */
export function otpAttemptKey(email: string) {
  return `otp:attempt:${email}`;
}

/** Spec: otp:lock:{email} */
export function otpLockKey(email: string) {
  return `otp:lock:${email}`;
}

/** Spec: temp_token:used:{jti} */
export function tempTokenUsedKey(jti: string) {
  return `temp_token:used:${jti}`;
}

/** FR-003 reset OTP lock */
export function resetOtpLockKey(email: string) {
  return `reset:otp:lock:${email}`;
}

export function resetOtpAttemptKey(email: string) {
  return `reset:otp:attempt:${email}`;
}

/** FR-003 reset_token single-use */
export function resetTokenUsedKey(jti: string) {
  return `reset_token:used:${jti}`;
}

/** FR-002 login lock (5 fails → 15 min) */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_TTL_SECONDS = 900;

export function loginAttemptKey(email: string) {
  return `login:attempt:${email.toLowerCase()}`;
}

export function loginLockKey(email: string) {
  return `login:lock:${email.toLowerCase()}`;
}

/** Admin MFA (OTP 2FA) */
export const ADMIN_MFA_TTL_SECONDS = 300; // 5 phút
export const MAX_MFA_ATTEMPTS = 3;

/** Lưu pending session JSON (chờ MFA) */
export function adminMfaSessionKey(mfaToken: string) {
  return `admin:mfa:session:${mfaToken}`;
}

/** Đếm số lần nhập OTP sai */
export function adminMfaAttemptKey(mfaToken: string) {
  return `admin:mfa:attempt:${mfaToken}`;
}

/** Cooldown gửi OTP (60s) — tránh Supabase silently drop duplicate sends */
export const ADMIN_MFA_COOLDOWN_SECONDS = 60;

export function adminMfaCooldownKey(email: string) {
  return `admin:mfa:cooldown:${email.toLowerCase()}`;
}

/** Context for branded OTP emails (read by auth-send-email hook). */
export const OTP_EMAIL_CTX_TTL_SECONDS = 60;

export function otpEmailContextKey(email: string) {
  return `otp:email:ctx:${email.toLowerCase()}`;
}

/** Patient DOB step-up verification */
export const MAX_DOB_ATTEMPTS = 5;
export const DOB_LOCK_TTL_SECONDS = 900;
export const DOB_VERIFIED_TTL_SECONDS = 3600;

export function dobAttemptKey(userId: string) {
  return `dob:attempt:${userId}`;
}

export function dobLockKey(userId: string) {
  return `dob:lock:${userId}`;
}

export function dobVerifiedKey(userId: string) {
  return `dob:verified:${userId}`;
}

export async function clearPatientDobSession(
  redis: RedisLike,
  userId: string,
): Promise<void> {
  await redis.del(dobVerifiedKey(userId));
  await redis.del(dobAttemptKey(userId));
  await redis.del(dobLockKey(userId));
}

/** Pending patient login — DOB required before session is issued */
export const PATIENT_DOB_LOGIN_TTL_SECONDS = 300;
export const MAX_PATIENT_DOB_LOGIN_ATTEMPTS = 5;

export function patientDobLoginSessionKey(dobToken: string) {
  return `patient:dob:login:session:${dobToken}`;
}

export function patientDobLoginAttemptKey(dobToken: string) {
  return `patient:dob:login:attempt:${dobToken}`;
}
