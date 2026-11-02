import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.13";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSiteUrl } from "../_shared/site-url.ts";

interface RequestBody {
  appointment_id: string;
  cancel_reason: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpUser || !smtpPass) {
    console.warn("[notify-appointment-cancelled] SMTP_USER/SMTP_PASS not set, skipping email.");
    return jsonResponse({ skipped: true });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { appointment_id, cancel_reason } = body;

    if (!appointment_id || !cancel_reason) {
      return jsonResponse({ error: "appointment_id and cancel_reason are required" }, 422);
    }

    // ── 1. Fetch appointment details ──────────────────────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: appt, error: apptErr } = await admin
      .from("appointments")
      .select(`
        id, created_at,
        specialties ( name ),
        appointment_slots ( slot_date, start_time, end_time ),
        patient ( user_id, legal_first_name, legal_last_name )
      `)
      .eq("id", appointment_id)
      .single();

    if (apptErr || !appt) {
      console.error("[notify-appointment-cancelled] lookup:", apptErr?.message);
      return jsonResponse({ error: "Appointment not found" }, 404);
    }

    const pt      = appt.patient        as Record<string, string> | null;
    const sl      = appt.appointment_slots as Record<string, string> | null;
    const sp      = appt.specialties    as Record<string, string> | null;
    const userId  = pt?.user_id;
    const fullName = [pt?.legal_last_name, pt?.legal_first_name].filter(Boolean).join(" ") || "Bệnh nhân";

    if (!userId) return jsonResponse({ error: "No patient user_id" }, 422);

    // ── 2. Resolve patient email ──────────────────────────────────────────────
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user?.email) {
      console.error("[notify-appointment-cancelled] auth lookup:", authErr?.message);
      return jsonResponse({ error: "Cannot resolve patient email" }, 422);
    }
    const toEmail = authUser.user.email;

    // ── 3. Build content ──────────────────────────────────────────────────────
    const appointmentLine = sl?.slot_date
      ? `${sl.start_time?.slice(0, 5)} – ${sl.end_time?.slice(0, 5)}, ngày ${formatDate(sl.slot_date)}`
      : `Walk-in, ${formatDate(appt.created_at?.slice(0, 10))}`;

    const specialtyName = sp?.name ?? "—";
    const siteUrl       = getSiteUrl();
    const fromName      = Deno.env.get("EMAIL_FROM_NAME") ?? "RcarePlus";

    // ── 4. Send via Gmail SMTP ────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host:   "smtp.gmail.com",
      port:   587,
      secure: false,        // STARTTLS
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from:    `"${fromName}" <${smtpUser}>`,
      to:      toEmail,
      subject: "Thông báo hủy lịch hẹn – RcarePlus",
      html:    buildEmailHtml({ fullName, appointmentLine, specialtyName, cancel_reason, siteUrl }),
    });

    console.info("[notify-appointment-cancelled] email sent to", toEmail);
    return jsonResponse({ sent: true, email: toEmail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[notify-appointment-cancelled]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(p: {
  fullName: string;
  appointmentLine: string;
  specialtyName: string;
  cancel_reason: string;
  siteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#c0392b;padding:28px 36px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">RcarePlus</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Hệ thống quản lý y tế</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;">
              Xin chào <strong>${escHtml(p.fullName)}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Lịch hẹn khám bệnh của bạn đã bị <strong style="color:#c0392b;">hủy</strong>.
            </p>

            <!-- Card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;">
                  Chi tiết lịch hẹn
                </p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#6b7280;padding:3px 16px 3px 0;white-space:nowrap;">Chuyên khoa</td>
                    <td style="font-size:13px;color:#111827;font-weight:500;">${escHtml(p.specialtyName)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6b7280;padding:3px 16px 3px 0;white-space:nowrap;">Thời gian</td>
                    <td style="font-size:13px;color:#111827;font-weight:500;">${escHtml(p.appointmentLine)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6b7280;padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">Lý do hủy</td>
                    <td style="font-size:13px;color:#111827;font-weight:500;">${escHtml(p.cancel_reason)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
              Nếu bạn muốn đặt lại lịch, vui lòng truy cập hệ thống.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#c0392b;border-radius:8px;">
                  <a href="${escHtml(p.siteUrl)}/appointments/book"
                     style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">
                    Đặt lịch mới
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
              Email tự động từ RcarePlus – vui lòng không trả lời.<br/>
              © 2026 RcarePlus
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
