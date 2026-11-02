import nodemailer from "npm:nodemailer@6.9.13";

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

function fromHeader(fromName: string, address: string): string {
  return `"${fromName.replace(/"/g, "")}" <${address}>`;
}

export async function sendHtmlEmail(input: SendMailInput): Promise<void> {
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const fromName = Deno.env.get("EMAIL_FROM_NAME") ?? "RCARE Medical Security Portal";

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
      port: Number(Deno.env.get("SMTP_PORT") ?? "587"),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: fromHeader(fromName, smtpUser),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return;
  }

  const host = Deno.env.get("SMTP_HOST") ?? "127.0.0.1";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "54325");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    ignoreTLS: true,
  });
  await transporter.sendMail({
    from: fromHeader(fromName, "noreply@rcare.local"),
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
