# OTP 6 số qua supabase-js

OTP emails are branded RCARE HTML, sent by the `auth-send-email` Auth hook (not GoTrue’s default template). Verification is unchanged: `verifyOtp`.

## Luồng gửi OTP

```ts
// src/lib/signup-api.ts — sau khi edge signup-send-otp validate
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true },
});
```

Edge functions set a short-lived Redis context (`otp:email:ctx:{email}`) so the hook can pick the right copy:

- Admin 2FA (`portal-login`) → `admin_mfa` (name, masked IP, 5-minute expiry)
- Signup (`signup-send-otp`) → `signup`
- Forgot password → `reset`
- Patient MFA enroll → `patient_mfa`

## Luồng xác minh

```ts
await supabase.auth.verifyOtp({
  email,
  token: otp,
  type: "email",
});
```

## Local

1. `npm run supabase:start` — GoTrue calls `http://host.docker.internal:54321/functions/v1/auth-send-email`
2. `npm run supabase:functions` — serve the hook (`verify_jwt` is off)
3. Without `SMTP_USER` / `SMTP_PASS`, mail goes to Inbucket SMTP `127.0.0.1:54325` (Studio **Inbucket**, port 54324)
4. With Gmail SMTP in `.env` / `supabase/functions/.env`, mail is sent via `smtp.gmail.com`

Local hook HMAC in `supabase/config.toml` is a **dev dummy**. The function uses `SEND_EMAIL_HOOK_SECRET` when set, otherwise the same dummy.

Keep Auth functions running while testing login/signup OTP. If the hook is down, `signInWithOtp` fails.

Do **not** `supabase config push` the local hook URI (`host.docker.internal`) to a hosted project.

## Hosted (Supabase Dashboard)

1. Deploy: `npm run supabase:deploy-functions` (includes `auth-send-email`)
2. **Authentication → Hooks → Send Email**
   - HTTPS URL: `https://<project-ref>.supabase.co/functions/v1/auth-send-email`
   - Generate secret (`v1,whsec_…`)
3. Secrets:

```bash
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_<dashboard-secret>"
supabase secrets set SMTP_USER="<gmail-user>"
supabase secrets set SMTP_PASS="<app-password>"
# optional
supabase secrets set EMAIL_FROM_NAME="RCARE Medical Security Portal"
```

4. **Authentication → Providers → Email** — Email + **Email OTP** on; **Confirm email** off (avoids “Confirm your signup” links)

Do not spoof `security@rcare.vn` as the From address unless SPF/DKIM are set. The From **name** is `RCARE Medical Security Portal`; the address is `SMTP_USER`.

## Auth email types

The hook sends branded OTP HTML when the token is 6 digits (`magiclink` / signup OTP). Recovery, invite, and confirmation emails still use the existing Vietnamese **link** copy so staff invite (24h `otp_expiry`) keeps working.

App OTP windows remain **5 minutes** (`OTP_TTL_SECONDS` / `ADMIN_MFA_TTL_SECONDS`). Do not lower `[auth.email] otp_expiry` (used for invite/recovery links).

## Config local / remote

```toml
[auth.email]
enable_confirmations = false
otp_length = 6
otp_expiry = 86400
```

```bash
npm run supabase:deploy-functions
```
