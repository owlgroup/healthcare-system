import * as jose from "npm:jose@5.9.6";

const ISSUER = "qcare-reset";
const AUDIENCE = "qcare-reset-password";
const SCOPE = "reset_password";
const RESET_TOKEN_EXP = "10m";
const RESET_TOKEN_EXP_SECONDS = 600;

export type ResetTokenPayload = {
  email: string;
  userId: string;
  jti: string;
  scope: string;
};

function getSecret(): Uint8Array {
  const secret = Deno.env.get("RESET_TOKEN_SECRET") ??
    Deno.env.get("TEMP_TOKEN_SECRET") ??
    Deno.env.get("SIGNUP_TEMP_TOKEN_SECRET") ??
    Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) {
    throw new Error("RESET_TOKEN_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signResetToken(
  email: string,
  userId: string,
): Promise<{ token: string; jti: string; expiresIn: number }> {
  const secret = getSecret();
  const jti = crypto.randomUUID();
  const token = await new jose.SignJWT({ email, userId, scope: SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(RESET_TOKEN_EXP)
    .sign(secret);

  return { token, jti, expiresIn: RESET_TOKEN_EXP_SECONDS };
}

export async function verifyResetToken(
  token: string,
): Promise<ResetTokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const email = typeof payload.email === "string" ? payload.email : null;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const scope = typeof payload.scope === "string" ? payload.scope : null;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    if (!email || !userId || scope !== SCOPE || !jti) return null;
    return { email, userId, jti, scope };
  } catch {
    return null;
  }
}
