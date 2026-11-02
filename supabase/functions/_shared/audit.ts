import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export type AuditEventType =
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_FAILED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "LOGIN_WRONG_PORTAL"
  | "LOGOUT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_LOCKED"
  | "ADMIN_PASSWORD_RESET"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ADMIN_MFA_SENT"
  | "ADMIN_MFA_SUCCESS"
  | "ADMIN_MFA_FAILED"
  | "DOB_VERIFY_SUCCESS"
  | "DOB_VERIFY_FAILED"
  | "DOB_VERIFY_LOCKED";

type AuditParams = {
  eventType: AuditEventType;
  userId?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(
  admin: SupabaseClient,
  params: AuditParams,
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    user_id: params.userId ?? null,
    email: params.email ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    console.error("[audit]", params.eventType, error.message);
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
}

export function clientUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua?.slice(0, 512) ?? null;
}
