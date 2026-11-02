import { clientIp, clientUserAgent, writeAuditLog } from "../_shared/audit.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getPatientDobStatus, verifyPatientDob } from "../_shared/patient-dob.ts";
import { isAuthContext, requirePatientRole } from "../_shared/rbac.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);

  try {
    const auth = await requirePatientRole(req);
    if (!isAuthContext(auth)) return auth;

    const { admin, userId, email } = auth;
    const body = await req.json() as { date_of_birth?: string };
    const submittedDob = typeof body.date_of_birth === "string"
      ? body.date_of_birth.trim()
      : "";

    const result = await verifyPatientDob(admin, userId, submittedDob);

    if (!result.ok) {
      const eventType = result.error === "DOB_LOCKED"
        ? "DOB_VERIFY_LOCKED"
        : "DOB_VERIFY_FAILED";

      await writeAuditLog(admin, {
        eventType,
        userId,
        email,
        ipAddress: ip,
        userAgent,
        metadata: {
          reason: result.error,
          attemptsLeft: result.attemptsLeft ?? null,
        },
      });

      return jsonResponse(
        {
          error: result.error,
          message: result.message,
          attemptsLeft: result.attemptsLeft,
          retryAfter: result.retryAfter,
        },
        result.status,
      );
    }

    await writeAuditLog(admin, {
      eventType: "DOB_VERIFY_SUCCESS",
      userId,
      email,
      ipAddress: ip,
      userAgent,
      metadata: {},
    });

    return jsonResponse({ message: "Xác thực ngày sinh thành công", verified: true });
  } catch (err) {
    console.error("[patient-dob-verify]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "VERIFY_FAILED", message: "Xác thực thất bại" }, 500);
  }
});
