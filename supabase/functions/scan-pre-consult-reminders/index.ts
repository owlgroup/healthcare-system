import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendPreConsultReminderEmail } from "../_shared/pre-consult-reminder-email.ts";

type CandidateRow = {
  id: string;
};

function isAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (serviceKey && bearer === serviceKey) return true;

  const headerSecret = req.headers.get("x-cron-secret");
  if (cronSecret && headerSecret === cronSecret) return true;

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const { data: candidates, error: queryErr } = await admin.rpc("find_pre_consult_reminder_candidates");

    if (queryErr) {
      console.error("[scan-pre-consult-reminders] query:", queryErr.message);
      return jsonResponse({ error: queryErr.message }, 500);
    }

    const rows = (candidates ?? []) as CandidateRow[];
    if (rows.length === 0) {
      return jsonResponse({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ appointment_id: string; status: string; email?: string; reason?: string }> = [];

    for (const row of rows) {
      const result = await sendPreConsultReminderEmail(admin, row.id);

      if ("sent" in result) {
        const { error: markErr } = await admin
          .from("appointments")
          .update({ pre_consult_auto_reminder_sent: true })
          .eq("id", row.id);

        if (markErr) {
          console.error("[scan-pre-consult-reminders] mark sent:", markErr.message);
          failed += 1;
          details.push({ appointment_id: row.id, status: "failed", reason: markErr.message });
          continue;
        }

        sent += 1;
        details.push({ appointment_id: row.id, status: "sent", email: result.email });
        console.info("[scan-pre-consult-reminders] sent to", result.email, "for", row.id);
        continue;
      }

      if ("skipped" in result) {
        skipped += 1;
        details.push({ appointment_id: row.id, status: "skipped", reason: result.reason });
        continue;
      }

      failed += 1;
      details.push({ appointment_id: row.id, status: "failed", reason: result.error });
      console.warn("[scan-pre-consult-reminders] failed for", row.id, result.error);
    }

    return jsonResponse({
      processed: rows.length,
      sent,
      skipped,
      failed,
      details,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[scan-pre-consult-reminders]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
