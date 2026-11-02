# Đăng ký bằng link xác nhận email (Confirm signup)

Luồng app: **Email → nhấn link trong Gmail → đặt mật khẩu**.

## Supabase Dashboard

1. **Authentication → Providers → Email** — bật Email.
2. **Authentication → Sign In / Providers** — bật **Confirm email** (xác nhận đăng ký).
3. **Authentication → URL Configuration**
   - Site URL: URL dev của bạn (ví dụ `http://localhost:5173`)
   - Redirect URLs: thêm `{origin}/auth/callback` (ví dụ `http://localhost:5173/auth/callback`)
4. **(Tuỳ chọn) SMTP** — gửi tới mọi địa chỉ Gmail.

## Email người dùng nhận

- Tiêu đề: **Confirm Your Signup**
- Nút/link: **Confirm your mail**
- Sau khi nhấn → trình duyệt mở `/auth/callback` → chuyển sang bước đặt mật khẩu.

## CLI (project đã link)

```bash
supabase config push --yes
npm run supabase:deploy-functions
```

`supabase/config.toml` đã có `enable_confirmations = true` và các redirect URL local.

## Local (`supabase start`)

Xem email test tại http://localhost:54324 (Inbucket).
