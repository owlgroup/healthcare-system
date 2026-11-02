export type OtpEmailVariant =
  | "admin_mfa"
  | "signup"
  | "reset"
  | "patient_mfa"
  | "generic";

export type OtpEmailContext = {
  variant: OtpEmailVariant;
  fullName?: string;
  ip?: string | null;
  requestedAt?: string;
  ttlSeconds?: number;
};

export type OtpEmailInput = {
  variant: OtpEmailVariant;
  otp: string;
  recipientName?: string;
  ipAddress?: string | null;
  requestedAt?: Date;
  ttlSeconds?: number;
};

export type AuthLinkEmailType =
  | "recovery"
  | "invite"
  | "confirmation"
  | "email_change"
  | "magiclink";

const OTP_VARIANTS = new Set<OtpEmailVariant>([
  "admin_mfa",
  "signup",
  "reset",
  "patient_mfa",
  "generic",
]);

const DEFAULT_TTL_SECONDS = 300;
const GMT7 = "Asia/Ho_Chi_Minh";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function maskIp(ip: string | null | undefined): string {
  const trimmed = ip?.trim() ?? "";
  if (!trimmed) return "—";
  const ipv4 = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) return `${ipv4[1]}.XX`;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return `${parts.slice(0, Math.max(parts.length - 1, 1)).join(":")}:XX`;
  }
  return "—";
}

export function isOtpToken(token: string): boolean {
  return /^\d{6}$/.test(token);
}

export function resolveOtpVariant(
  contextVariant: string | undefined,
  emailActionType: string,
): OtpEmailVariant {
  if (contextVariant && OTP_VARIANTS.has(contextVariant as OtpEmailVariant)) {
    return contextVariant as OtpEmailVariant;
  }
  if (emailActionType === "signup") return "signup";
  if (emailActionType === "recovery") return "reset";
  if (emailActionType === "reauthentication") return "patient_mfa";
  return "generic";
}

export function parseOtpEmailContext(raw: string | null): OtpEmailContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const variant = parsed.variant;
    if (typeof variant !== "string" || !OTP_VARIANTS.has(variant as OtpEmailVariant)) {
      return null;
    }
    const ctx: OtpEmailContext = { variant: variant as OtpEmailVariant };
    if (typeof parsed.fullName === "string") ctx.fullName = parsed.fullName;
    if (typeof parsed.ip === "string" || parsed.ip === null) ctx.ip = parsed.ip as string | null;
    if (typeof parsed.requestedAt === "string") ctx.requestedAt = parsed.requestedAt;
    if (typeof parsed.ttlSeconds === "number" && Number.isFinite(parsed.ttlSeconds)) {
      ctx.ttlSeconds = parsed.ttlSeconds;
    }
    return ctx;
  } catch {
    return null;
  }
}

function gmt7Parts(
  date: Date,
  opts: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GMT7,
    ...opts,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

export function formatGmt7Time(date: Date): string {
  const p = gmt7Parts(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${p.hour}:${p.minute}:${p.second} ${p.dayPeriod} (GMT+7)`;
}

export function formatGmt7Clock(date: Date): string {
  const p = gmt7Parts(date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

export function buildOtpEmailSubject(variant: OtpEmailVariant, otp: string): string {
  switch (variant) {
    case "admin_mfa":
      return `[RCARE Portal] Mã OTP xác thực 2 lớp đăng nhập Bác sĩ / Admin: ${otp}`;
    case "signup":
      return `[RCARE Portal] Mã OTP đăng ký: ${otp}`;
    case "reset":
      return `[RCARE Portal] Mã OTP đặt lại mật khẩu: ${otp}`;
    case "patient_mfa":
      return `[RCARE Portal] Mã OTP xác thực 2 lớp: ${otp}`;
    default:
      return `[RCARE Portal] Mã OTP xác thực: ${otp}`;
  }
}

function greeting(variant: OtpEmailVariant, name: string): string {
  const safe = escHtml(name);
  if (variant === "admin_mfa") return `Chào <strong>Bác sĩ/Admin ${safe}</strong>,`;
  return `Chào <strong>${safe}</strong>,`;
}

function introCopy(variant: OtpEmailVariant): string {
  switch (variant) {
    case "admin_mfa":
      return "Yêu cầu xác thực đăng nhập";
    case "signup":
      return "Yêu cầu xác thực đăng ký tài khoản";
    case "reset":
      return "Yêu cầu đặt lại mật khẩu";
    case "patient_mfa":
      return "Yêu cầu bật xác thực 2 lớp";
    default:
      return "Yêu cầu xác thực";
  }
}

function requestLabel(variant: OtpEmailVariant): string {
  switch (variant) {
    case "admin_mfa":
    case "patient_mfa":
      return "Xác thực 2 lớp (2FA)";
    case "signup":
      return "Đăng ký tài khoản";
    case "reset":
      return "Đặt lại mật khẩu";
    default:
      return "Xác thực OTP";
  }
}

function roleLabel(variant: OtpEmailVariant): string {
  if (variant === "admin_mfa") return "RCARE Medical & Admin Portal";
  return "RCARE Medical Portal";
}

function infoRow(label: string, valueHtml: string): string {
  return `<tr>
    <td style="width:42%;padding:10px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;">${escHtml(label)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;font-family:Arial,Helvetica,sans-serif;">${valueHtml}</td>
  </tr>`;
}

export function buildOtpEmailHtml(input: OtpEmailInput): string {
  const ttl = input.ttlSeconds && input.ttlSeconds > 0 ? input.ttlSeconds : DEFAULT_TTL_SECONDS;
  const requestedAt = input.requestedAt ?? new Date();
  const expiresAt = new Date(requestedAt.getTime() + ttl * 1000);
  const ttlMinutes = Math.max(1, Math.round(ttl / 60));
  const name = (input.recipientName ?? "").trim() || "bạn";
  const showIp = input.variant === "admin_mfa" && Boolean(input.ipAddress?.trim());

  const rows = [
    infoRow("Yêu cầu", escHtml(requestLabel(input.variant))),
    infoRow("Vai trò", escHtml(roleLabel(input.variant))),
    infoRow("Mức bảo mật", "HIPAA Compliance / High Security"),
  ];
  if (showIp) {
    rows.push(infoRow("Địa chỉ IP", escHtml(maskIp(input.ipAddress))));
  }
  rows.push(infoRow("Thời gian", escHtml(formatGmt7Time(requestedAt))));

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>RCARE OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-collapse:collapse;">

        <tr>
          <td style="background:#1e3a5f;padding:18px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
                  <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#ffffff;color:#1e3a5f;border-radius:4px;font-weight:700;font-size:14px;margin-right:10px;">R</span>
                  <span style="font-size:18px;font-weight:700;letter-spacing:0.5px;">RCARE</span>
                  <div style="font-size:11px;letter-spacing:1px;margin-top:4px;color:#dbeafe;">MEDICAL PORTAL</div>
                </td>
                <td valign="middle" align="right" style="white-space:nowrap;">
                  <span style="display:inline-block;background:#16a34a;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:8px 10px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;">SECURED<br/>2FA</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 24px 8px;color:#111827;font-size:15px;line-height:1.6;">
            ${greeting(input.variant, name)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;color:#374151;font-size:14px;line-height:1.6;">
            ${escHtml(introCopy(input.variant))}
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-collapse:collapse;">
              ${rows.join("")}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2563eb;border-radius:8px;">
              <tr>
                <td align="center" style="padding:22px 16px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:12px;letter-spacing:2px;font-weight:700;">OTP</div>
                  <div style="font-size:36px;font-weight:700;letter-spacing:6px;line-height:1.3;padding:8px 0;">${escHtml(input.otp)}</div>
                  <div style="font-size:13px;line-height:1.5;">Mã OTP này có hiệu lực trong <strong>${ttlMinutes} phút</strong> (Hết hạn lúc: ${escHtml(formatGmt7Clock(expiresAt))})</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dc2626;border-collapse:collapse;">
              <tr>
                <td style="background:#dc2626;color:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                  CẢNH BÁO BẢO MẬT &amp; QUYỀN RIÊNG TƯ
                </td>
              </tr>
              <tr>
                <td style="padding:14px;font-size:13px;color:#111827;line-height:1.6;background:#fff7f7;font-family:Arial,Helvetica,sans-serif;">
                  Bảo vệ thông tin Bệnh nhân là ưu tiên hàng đầu.
                  <strong>KHÔNG ĐƯỢC CHIA SẺ MÃ OTP NÀY.</strong>
                  Tuân thủ nghiêm ngặt quy định bảo mật RCARE và HIPAA.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f3f4f6;padding:16px 24px;text-align:center;font-size:11px;color:#6b7280;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
            RCARE IT Security | Bản quyền © 2026 | Trụ sở: TP.HCM |
            <a href="mailto:security@rcare.vn" style="color:#2563eb;">security@rcare.vn</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const LINK_SUBJECT: Record<AuthLinkEmailType, string> = {
  recovery: "Thiết lập mật khẩu — Rcare Plus",
  invite: "Mời tham gia Rcare Plus",
  confirmation: "Xác nhận email — Rcare Plus",
  email_change: "Xác nhận email mới — Rcare Plus",
  magiclink: "Liên kết đăng nhập — Rcare Plus",
};

export function buildAuthLinkEmailSubject(type: AuthLinkEmailType): string {
  return LINK_SUBJECT[type] ?? "Rcare Plus";
}

export function buildAuthLinkEmailHtml(type: AuthLinkEmailType, confirmationUrl: string): string {
  const url = escHtml(confirmationUrl);
  const bodies: Record<AuthLinkEmailType, string> = {
    recovery: `<h2>Thiết lập mật khẩu</h2>
<p>Xin chào,</p>
<p>Quản trị viên đã tạo tài khoản Rcare Plus cho bạn. Nhấn nút bên dưới để xác nhận email và đặt mật khẩu đăng nhập lần đầu.</p>
<p><a href="${url}">Thiết lập mật khẩu</a></p>
<p>Link có hiệu lực trong 24 giờ. Nếu link hết hạn, nhờ Quản trị viên gửi lại email từ trang Quản lý người dùng.</p>
<p>Nếu bạn không yêu cầu tài khoản này, có thể bỏ qua email.</p>
<p>— Rcare Plus</p>`,
    invite: `<h2>Mời tham gia Rcare Plus</h2>
<p>Xin chào,</p>
<p>Bạn được mời tham gia hệ thống Rcare Plus với vai trò nhân viên nội bộ. Nhấn nút bên dưới để xác nhận email và thiết lập mật khẩu.</p>
<p><a href="${url}">Chấp nhận lời mời</a></p>
<p>Link có hiệu lực trong 24 giờ.</p>
<p>— Rcare Plus</p>`,
    confirmation: `<h2>Xác nhận email</h2>
<p>Xin chào,</p>
<p>Nhấn nút bên dưới để xác nhận địa chỉ email và tiếp tục thiết lập tài khoản Rcare Plus.</p>
<p><a href="${url}">Xác nhận email</a></p>
<p>Link có hiệu lực trong 24 giờ.</p>
<p>— Rcare Plus</p>`,
    email_change: `<h2>Xác nhận email mới</h2>
<p>Xin chào,</p>
<p>Nhấn liên kết bên dưới để xác nhận địa chỉ email mới.</p>
<p><a href="${url}">Xác nhận email</a></p>
<p>— Rcare Plus</p>`,
    magiclink: `<h2>Liên kết đăng nhập</h2>
<p>Xin chào,</p>
<p>Nhấn liên kết bên dưới để đăng nhập Rcare Plus.</p>
<p><a href="${url}">Đăng nhập</a></p>
<p>— Rcare Plus</p>`,
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
${bodies[type] ?? bodies.confirmation}
</body>
</html>`;
}

export function planAuthEmail(input: {
  emailActionType: string;
  token: string;
  context: OtpEmailContext | null;
}): { kind: "otp"; variant: OtpEmailVariant } | { kind: "link"; type: AuthLinkEmailType } {
  if (isOtpToken(input.token)) {
    return {
      kind: "otp",
      variant: resolveOtpVariant(input.context?.variant, input.emailActionType),
    };
  }
  const action = input.emailActionType;
  if (action === "invite") return { kind: "link", type: "invite" };
  if (action === "recovery") return { kind: "link", type: "recovery" };
  if (action === "email_change" || action === "email_change_new") {
    return { kind: "link", type: "email_change" };
  }
  if (action === "magiclink") return { kind: "link", type: "magiclink" };
  return { kind: "link", type: "confirmation" };
}

export function buildConfirmationUrl(
  supabaseUrl: string,
  tokenHash: string,
  emailActionType: string,
  redirectTo: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    token: tokenHash,
    type: emailActionType,
    redirect_to: redirectTo,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}
