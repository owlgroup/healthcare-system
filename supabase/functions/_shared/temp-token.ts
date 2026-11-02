import * as jose from "npm:jose@5.9.6";

const ISSUER = "qcare-signup";
const AUDIENCE = "qcare-signup-password";
const SCOPE = "set_password";
const TEMP_TOKEN_EXP = "10m";

export type TempTokenPayload = {
  email: string;
  jti: string;
  scope: string;
};

function getSecret(): Uint8Array {
  const secret = Deno.env.get("TEMP_TOKEN_SECRET") ??
    Deno.env.get("SIGNUP_TEMP_TOKEN_SECRET") ??
    Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) {
    throw new Error("TEMP_TOKEN_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signTempToken(email: string): Promise<{
  token: string;
  jti: string;
  expiresIn: number;
}> {
  const secret = getSecret();
  const jti = crypto.randomUUID();
  const token = await new jose.SignJWT({ email, scope: SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(TEMP_TOKEN_EXP)
    .sign(secret);

  return { token, jti, expiresIn: 600 };
}

export async function verifyTempToken(
  token: string,
): Promise<TempTokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const email = typeof payload.email === "string" ? payload.email : null;
    const scope = typeof payload.scope === "string" ? payload.scope : null;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    if (!email || scope !== SCOPE || !jti) return null;
    return { email, jti, scope };
  } catch {
    return null;
  }
}
