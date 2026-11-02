import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.13";
import { getSiteUrl } from "./site-url.ts";

export type PreConsultReminderResult =
  | { sent: true; email: string }
  | { skipped: true; reason: string }
  | { error: string };

export async function sendPreConsultReminderEmail(
  admin: SupabaseClient,
  appointmentId: string,
): Promise<PreConsultReminderResult> {
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpUser || !smtpPass) {
    return { skipped: true, reason: "SMTP not configured" };
  }

  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .select(`
      id, created_at, status,
      specialties ( name ),
      appointment_slots ( slot_date, start_time, end_time ),
      patient ( user_id, legal_first_name, legal_last_name ),
      pre_consultations ( status )
    `)
    .eq("id", appointmentId)
    .single();

  if (apptErr || !appt) {
    return { error: "Appointment not found" };
  }

  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appt.status as string)) {
    return { error: "Appointment is not active" };
  }

  const pcRaw = appt.pre_consultations as Record<string, string> | Record<string, string>[] | null;
  const pc = (Array.isArray(pcRaw) ? pcRaw[0] : pcRaw) ?? null;
  if (pc?.status === "SUBMITTED") {
    return { error: "Pre-consultation already submitted" };
  }

  const pt = appt.patient as Record<string, string> | null;
  const sl = appt.appointment_slots as Record<string, string> | null;
  const sp = appt.specialties as Record<string, string> | null;
  const userId = pt?.user_id;
  const fullName = [pt?.legal_last_name, pt?.legal_first_name].filter(Boolean).join(" ") || "Bệnh nhân";

  if (!userId) return { error: "No patient user_id" };

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user?.email) {
    return { error: "Cannot resolve patient email" };
  }
  const toEmail = authUser.user.email;

  const appointmentLine = sl?.slot_date
    ? `${sl.start_time?.slice(0, 5)} – ${sl.end_time?.slice(0, 5)}, ngày ${formatDate(sl.slot_date)}`
    : `Walk-in, ${formatDate(appt.created_at?.slice(0, 10))}`;

  const specialtyName = sp?.name ?? "—";
  const siteUrl = getSiteUrl();
  const fromName = Deno.env.get("EMAIL_FROM_NAME") ?? "RcarePlus";
  const preConsultUrl = `${siteUrl}/appointments/${appointmentId}/pre-consultation`;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to: toEmail,
    subject: "Nhắc nhở khai báo y tế trước khám – RcarePlus",
    html: buildEmailHtml({
      fullName,
      appointmentLine,
      specialtyName,
      preConsultUrl,
      siteUrl,
    }),
  });

  return { sent: true, email: toEmail };
}

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
  preConsultUrl: string;
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

        <tr>
          <td style="background:#db2777;padding:28px 36px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">RcarePlus</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px;">Nhắc nhở khai báo y tế trước khám</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;">
              Xin chào <strong>${escHtml(p.fullName)}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Bạn có lịch khám sắp tới. Vui lòng hoàn thành <strong>khai báo y tế trước khám</strong>
              để bác sĩ chuẩn bị tốt hơn cho buổi khám của bạn.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9d174d;text-transform:uppercase;letter-spacing:.5px;">
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
                </table>
              </td></tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#db2777;border-radius:8px;">
                  <a href="${escHtml(p.preConsultUrl)}"
                     style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">
                    Khai báo y tế trước khám
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;word-break:break-all;">
              Hoặc mở liên kết: <a href="${escHtml(p.preConsultUrl)}" style="color:#db2777;">${escHtml(p.preConsultUrl)}</a>
            </p>
          </td>
        </tr>

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
