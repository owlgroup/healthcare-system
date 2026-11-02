import { Webhook } from "npm:standardwebhooks@1.0.0";
import { sendAuthEmail } from "../_shared/auth-email-send.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

type HookUser = {
  email?: string;
};

type HookEmailData = {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type?: string;
  site_url?: string;
};

function hookSecret(): string {
  const fromEnv = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const raw = fromEnv && fromEnv.length > 0
    ? fromEnv
    : "v1,whsec_bG9jYWwtZGV2LXNlbmQtZW1haWwtaG9vay1zZWNyZXQtMzJieXRlcw==";
  return raw.replace("v1,whsec_", "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = hookSecret();

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(payload, headers) as {
      user?: HookUser;
      email_data?: HookEmailData;
    };
    const to = verified.user?.email?.trim().toLowerCase() ?? "";
    const emailData = verified.email_data ?? {};
    if (!to) {
      return jsonResponse({ error: "MISSING_EMAIL" }, 400);
    }

    await sendAuthEmail({
      to,
      emailActionType: emailData.email_action_type ?? "",
      token: emailData.token ?? "",
      tokenHash: emailData.token_hash ?? "",
      redirectTo: emailData.redirect_to ?? "",
      siteUrl: emailData.site_url ?? "",
    });

    return jsonResponse({});
  } catch (err) {
    const name = err instanceof Error ? err.name : "error";
    console.error("[auth-send-email]", name);
    const unauthorized = name === "WebhookVerificationError" || /webhook|signature/i.test(name);
    return jsonResponse(
      { error: unauthorized ? "UNAUTHORIZED" : "SEND_FAILED" },
      unauthorized ? 401 : 500,
    );
  }
});
