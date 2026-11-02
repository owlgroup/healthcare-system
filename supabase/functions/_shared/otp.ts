import bcrypt from "npm:bcryptjs@2.4.3";

const OTP_BCRYPT_ROUNDS = 10;

export function generateOtp(): string {
  const n = crypto.randomInt(100000, 1000000);
  return String(n);
}

export async function hashOtp(otp: string): Promise<string> {
  return await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
}

export async function verifyOtpBcrypt(otp: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(otp, hash);
}
