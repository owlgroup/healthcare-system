# Responsive Web App

## Supabase setup

1. Copy `.env.example` to `.env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Authentication → Providers → Email**: bật Email + **Email OTP** (6 số), **tắt Confirm email**.
4. Chi tiết: [docs/supabase-email-otp-setup.md](docs/supabase-email-otp-setup.md)
5. **SMTP** (tùy chọn): gửi tới mọi Gmail.

```bash
npm run dev
```

## Đăng ký 3 bước (supabase-js OTP)

| Bước | UI | Backend |
|------|-----|---------|
| 1 | Email | Edge validate → `supabase.auth.signInWithOtp({ email })` |
| 2 | OTP 6 số | `supabase.auth.verifyOtp` (+ edge lock nếu sai) |
| 3 | Mật khẩu | `signup-complete` → `admin.updateUserById` |

Sau đăng ký → `/onboarding/profile`.

## Quên mật khẩu (FR-003)

| Bước | UI | Backend |
|------|-----|---------|
| 1 | Email | `forgot-password-send-otp` (không lộ email không tồn tại) |
| 2 | OTP | `forgot-password-verify-otp` → `reset_token` |
| 3 | Mật khẩu mới | `reset-password-complete` (history + revoke sessions + audit) |

Chi tiết: [docs/fr-003-password-reset.md](docs/fr-003-password-reset.md)

## Đăng nhập đa Portal (FR-002)

| Portal | URL đăng nhập |
|--------|----------------|
| Bệnh nhân | `/patient/login` |
| Bác sĩ | `/doctor/login` |
| Admin | `/admin/login` |

Chi tiết: [docs/fr-002-multi-portal-login.md](docs/fr-002-multi-portal-login.md)

### Deploy Edge Functions

```bash
npm run supabase:deploy-functions
# Optional Redis (khóa sau 3 lần sai OTP):
# supabase secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
```

### Local

```bash
supabase start
npm run supabase:functions
npm run dev
```

OTP local xem tại: http://localhost:54324 (Inbucket) khi `supabase start`.

### NPM scripts

| Script | Mô tả |
|--------|--------|
| `npm run supabase:deploy-functions` | Deploy signup functions |
| `npm run supabase:functions` | Serve functions local |
| `npm run test:e2e` | E2E signup (mock) |
