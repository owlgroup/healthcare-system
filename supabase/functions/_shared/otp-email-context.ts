import type { OtpEmailContext } from "./otp-email-html.ts";
import {
  getRedis,
  OTP_EMAIL_CTX_TTL_SECONDS,
  otpEmailContextKey,
} from "./redis.ts";

export async function setOtpEmailContext(
  email: string,
  ctx: OtpEmailContext,
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(otpEmailContextKey(email), JSON.stringify(ctx), {
      ex: OTP_EMAIL_CTX_TTL_SECONDS,
    });
  } catch (err) {
    console.error(
      "[otp-email-context] set failed",
      err instanceof Error ? err.name : "error",
    );
  }
}

export async function takeOtpEmailContext(email: string): Promise<string | null> {
  try {
    const redis = getRedis();
    const key = otpEmailContextKey(email);
    const raw = await redis.get(key);
    if (raw) await redis.del(key);
    return raw;
  } catch (err) {
    console.error(
      "[otp-email-context] take failed",
      err instanceof Error ? err.name : "error",
    );
    return null;
  }
}
