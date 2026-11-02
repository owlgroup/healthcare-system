import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendPreConsultReminderEmail } from "../_shared/pre-consult-reminder-email.ts";

interface RequestBody {
  appointment_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as RequestBody;
    const { appointment_id } = body;

    if (!appointment_id) {
      return jsonResponse({ error: "appointment_id is required" }, 422);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const result = await sendPreConsultReminderEmail(admin, appointment_id);

    if ("skipped" in result) {
      console.warn("[notify-pre-consult-reminder] SMTP_USER/SMTP_PASS not set, skipping email.");
      return jsonResponse({ skipped: true });
    }
    if ("error" in result) {
      const status = result.error === "Appointment not found" ? 404 : 422;
      return jsonResponse({ error: result.error }, status);
    }

    console.info("[notify-pre-consult-reminder] email sent to", result.email);
    return jsonResponse({ sent: true, email: result.email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[notify-pre-consult-reminder]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
