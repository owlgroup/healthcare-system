import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getPatientDobStatus } from "../_shared/patient-dob.ts";
import { isAuthContext, requirePatientRole } from "../_shared/rbac.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requirePatientRole(req);
    if (!isAuthContext(auth)) return auth;

    const { admin, userId } = auth;
    const status = await getPatientDobStatus(admin, userId);

    return jsonResponse(status);
  } catch (err) {
    console.error("[patient-dob-status]", err instanceof Error ? err.name : "error");
    return jsonResponse({ error: "STATUS_FAILED", message: "Không thể kiểm tra trạng thái" }, 500);
  }
});
