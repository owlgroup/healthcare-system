import { describe, expect, it } from "vitest";
import {
  buildAuthLinkEmailHtml,
  buildAuthLinkEmailSubject,
  buildOtpEmailHtml,
  buildOtpEmailSubject,
  escHtml,
  formatGmt7Clock,
  formatGmt7Time,
  isOtpToken,
  maskIp,
  parseOtpEmailContext,
  planAuthEmail,
  resolveOtpVariant,
} from "../../supabase/functions/_shared/otp-email-html.ts";

const OTP = "892401";
const REQUESTED_AT = new Date("2026-08-14T02:45:12.000Z"); // 09:45:12 GMT+7

describe("maskIp", () => {
  it("should mask the last IPv4 octet", () => {
    expect(maskIp("113.161.45.88")).toBe("113.161.45.XX");
  });

  it("should return em dash when IP is missing", () => {
    expect(maskIp(null)).toBe("—");
    expect(maskIp("")).toBe("—");
  });

  it("should not leak a full IPv4 address", () => {
    expect(maskIp("10.0.0.1")).not.toContain("10.0.0.1");
  });
});

describe("escHtml", () => {
  it("should escape HTML special characters", () => {
    expect(escHtml(`<img src=x onerror=alert(1)> & "'`)).toBe(
      "&lt;img src=x onerror=alert(1)&gt; &amp; &quot;&#39;",
    );
  });
});

describe("isOtpToken", () => {
  it("should accept a 6-digit OTP", () => {
    expect(isOtpToken("892401")).toBe(true);
  });

  it("should reject hashes and empty tokens", () => {
    expect(isOtpToken("7d5b7b1964cf5d388340a7f04f1dbb5eeb6c7b52ef8270e1737a58d0")).toBe(false);
    expect(isOtpToken("")).toBe(false);
  });
});

describe("resolveOtpVariant", () => {
  it("should prefer Redis context variant", () => {
    expect(resolveOtpVariant("admin_mfa", "magiclink")).toBe("admin_mfa");
  });

  it("should map signup action when context is missing", () => {
    expect(resolveOtpVariant(undefined, "signup")).toBe("signup");
  });

  it("should default magiclink without context to generic", () => {
    expect(resolveOtpVariant(undefined, "magiclink")).toBe("generic");
  });
});

describe("parseOtpEmailContext", () => {
  it("should parse a valid context payload", () => {
    const ctx = parseOtpEmailContext(
      JSON.stringify({ variant: "reset", fullName: "Nguyen Van A", ttlSeconds: 300 }),
    );
    expect(ctx?.variant).toBe("reset");
    expect(ctx?.fullName).toBe("Nguyen Van A");
    expect(ctx?.ttlSeconds).toBe(300);
  });

  it("should return null for invalid JSON", () => {
    expect(parseOtpEmailContext("not-json")).toBeNull();
    expect(parseOtpEmailContext(null)).toBeNull();
  });
});

describe("formatGmt7Time", () => {
  it("should format time in GMT+7 with AM/PM", () => {
    expect(formatGmt7Time(REQUESTED_AT)).toMatch(/09:45:12 AM \(GMT\+7\)/);
  });
});

describe("buildOtpEmailSubject", () => {
  it("should include OTP for admin 2FA", () => {
    expect(buildOtpEmailSubject("admin_mfa", OTP)).toBe(
      `[RCARE Portal] Mã OTP xác thực 2 lớp đăng nhập Bác sĩ / Admin: ${OTP}`,
    );
  });

  it("should include OTP for signup", () => {
    expect(buildOtpEmailSubject("signup", OTP)).toBe(
      `[RCARE Portal] Mã OTP đăng ký: ${OTP}`,
    );
  });

  it("should include OTP for password reset", () => {
    expect(buildOtpEmailSubject("reset", OTP)).toBe(
      `[RCARE Portal] Mã OTP đặt lại mật khẩu: ${OTP}`,
    );
  });

  it("should include OTP for patient MFA", () => {
    expect(buildOtpEmailSubject("patient_mfa", OTP)).toBe(
      `[RCARE Portal] Mã OTP xác thực 2 lớp: ${OTP}`,
    );
  });
});

describe("buildOtpEmailHtml", () => {
  const mfaHtml = buildOtpEmailHtml({
    variant: "admin_mfa",
    otp: OTP,
    recipientName: "Nguyễn Văn A",
    ipAddress: "113.161.45.88",
    requestedAt: REQUESTED_AT,
    ttlSeconds: 300,
  });

  it("should brand the header as RCARE MEDICAL PORTAL", () => {
    expect(mfaHtml).toContain("RCARE");
    expect(mfaHtml).toContain("MEDICAL PORTAL");
    expect(mfaHtml).toContain("SECURED");
    expect(mfaHtml).toContain("2FA");
  });

  it("should greet the admin recipient and state login verification", () => {
    expect(mfaHtml).toContain("Bác sĩ/Admin Nguyễn Văn A");
    expect(mfaHtml).toContain("Yêu cầu xác thực đăng nhập");
  });

  it("should highlight the OTP code", () => {
    expect(mfaHtml).toContain(OTP);
    expect(mfaHtml).toMatch(/font-size:\s*3[2-9]px|font-size:\s*[4-9]\dpx/);
  });

  it("should show 5-minute validity and expiry clock", () => {
    expect(mfaHtml).toContain("5 phút");
    expect(mfaHtml).toContain(formatGmt7Clock(new Date(REQUESTED_AT.getTime() + 300_000)));
  });

  it("should warn not to share the OTP", () => {
    expect(mfaHtml).toContain("KHÔNG ĐƯỢC CHIA SẺ MÃ OTP NÀY");
    expect(mfaHtml).toContain("CẢNH BÁO BẢO MẬT");
  });

  it("should include the MFA info table with masked IP", () => {
    expect(mfaHtml).toContain("Xác thực 2 lớp");
    expect(mfaHtml).toContain("RCARE Medical &amp; Admin Portal");
    expect(mfaHtml).toContain("HIPAA");
    expect(mfaHtml).toContain("113.161.45.XX");
    expect(mfaHtml).not.toContain("113.161.45.88");
  });

  it("should escape recipient name HTML", () => {
    const html = buildOtpEmailHtml({
      variant: "signup",
      otp: OTP,
      recipientName: `<script>alert(1)</script>`,
      requestedAt: REQUESTED_AT,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should omit the IP row for generic OTP", () => {
    const html = buildOtpEmailHtml({
      variant: "generic",
      otp: OTP,
      requestedAt: REQUESTED_AT,
    });
    expect(html).toContain(OTP);
    expect(html).not.toContain("Địa chỉ IP");
    expect(html).toContain("Yêu cầu xác thực");
  });

  it("should use a table layout and viewport meta for email clients", () => {
    expect(mfaHtml).toContain("<table");
    expect(mfaHtml).toContain('name="viewport"');
    expect(mfaHtml).toContain("max-width:600px");
  });
});

describe("planAuthEmail", () => {
  it("should send branded OTP for a 6-digit magiclink token", () => {
    expect(planAuthEmail({ emailActionType: "magiclink", token: "892401", context: null })).toEqual({
      kind: "otp",
      variant: "generic",
    });
  });

  it("should use admin_mfa variant from Redis context", () => {
    expect(planAuthEmail({
      emailActionType: "magiclink",
      token: "892401",
      context: { variant: "admin_mfa" },
    })).toEqual({ kind: "otp", variant: "admin_mfa" });
  });

  it("should send a recovery link when the token is not a 6-digit OTP", () => {
    expect(planAuthEmail({
      emailActionType: "recovery",
      token: "hashed-token",
      context: null,
    })).toEqual({ kind: "link", type: "recovery" });
  });
});

describe("buildAuthLinkEmail", () => {
  it("should keep Vietnamese recovery copy and confirmation URL", () => {
    const url = "https://example.com/auth/v1/verify?token=abc&type=recovery";
    const html = buildAuthLinkEmailHtml("recovery", url);
    expect(html).toContain("Thiết lập mật khẩu");
    expect(html).toContain("https://example.com/auth/v1/verify?token=abc&amp;type=recovery");
    expect(buildAuthLinkEmailSubject("recovery")).toContain("Thiết lập mật khẩu");
  });

  it("should keep invite and confirmation copy", () => {
    expect(buildAuthLinkEmailHtml("invite", "https://x/invite")).toContain("Mời tham gia");
    expect(buildAuthLinkEmailHtml("confirmation", "https://x/confirm")).toContain("Xác nhận email");
    expect(buildAuthLinkEmailSubject("invite")).toContain("Mời tham gia");
  });
});
