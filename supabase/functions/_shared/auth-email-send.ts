import { takeOtpEmailContext } from "./otp-email-context.ts";
import {
  buildAuthLinkEmailHtml,
  buildAuthLinkEmailSubject,
  buildConfirmationUrl,
  buildOtpEmailHtml,
  buildOtpEmailSubject,
  parseOtpEmailContext,
  planAuthEmail,
} from "./otp-email-html.ts";
import { sendHtmlEmail } from "./smtp.ts";

export type AuthEmailPayload = {
  to: string;
  emailActionType: string;
  token: string;
  tokenHash: string;
  redirectTo: string;
  siteUrl: string;
};

export async function sendAuthEmail(payload: AuthEmailPayload): Promise<void> {
  const rawCtx = await takeOtpEmailContext(payload.to);
  const context = parseOtpEmailContext(rawCtx);
  const plan = planAuthEmail({
    emailActionType: payload.emailActionType,
    token: payload.token,
    context,
  });

  if (plan.kind === "otp") {
    const requestedAt = context?.requestedAt
      ? new Date(context.requestedAt)
      : new Date();
    const html = buildOtpEmailHtml({
      variant: plan.variant,
      otp: payload.token,
      recipientName: context?.fullName,
      ipAddress: plan.variant === "admin_mfa" ? context?.ip : undefined,
      requestedAt: Number.isNaN(requestedAt.getTime()) ? new Date() : requestedAt,
      ttlSeconds: context?.ttlSeconds,
    });
    await sendHtmlEmail({
      to: payload.to,
      subject: buildOtpEmailSubject(plan.variant, payload.token),
      html,
    });
    return;
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? payload.siteUrl).replace(/\/$/, "");
  const confirmationUrl = buildConfirmationUrl(
    supabaseUrl,
    payload.tokenHash,
    payload.emailActionType,
    payload.redirectTo,
  );
  await sendHtmlEmail({
    to: payload.to,
    subject: buildAuthLinkEmailSubject(plan.type),
    html: buildAuthLinkEmailHtml(plan.type, confirmationUrl),
  });
}
