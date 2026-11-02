# Tạo tài khoản nội bộ (Admin → Bác sĩ / Nhân viên)

## Luồng UAT

1. Admin tạo user tại **Quản lý người dùng**.
2. Hệ thống gửi email **Thiết lập mật khẩu** (tiếng Việt).
3. Bác sĩ/nhân viên mở link → `https://healthcare-system-ns.vercel.app/auth/set-password`.
4. Đặt mật khẩu → chuyển tới trang đăng nhập portal tương ứng.

## Cấu hình Supabase (bắt buộc trên môi trường test)

### 1. Authentication → URL Configuration

| Mục | Giá trị |
|-----|---------|
| Site URL | `https://healthcare-system-ns.vercel.app` |
| Redirect URLs | Thêm `.../auth/set-password`, `.../auth/callback` |

Hoặc đẩy từ repo:

```bash
supabase config push --yes
```

### 2. Secret Edge Functions

```bash
supabase secrets set SITE_URL=https://healthcare-system-ns.vercel.app
```

### 3. Deploy function sau khi sửa code

```bash
npm run supabase:deploy-functions
```

## Link hết hạn (`otp_expired`)

- Link email có hiệu lực **24 giờ** (`otp_expiry = 86400` trong `supabase/config.toml`).
- Mỗi link chỉ dùng **một lần** — không mở lại link cũ sau khi đã thiết lập mật khẩu.
- Nếu hết hạn: Admin vào user → **Đặt lại mật khẩu** để gửi email mới.

## Local dev (port 8080)

Vite chạy tại `http://localhost:8080`. Redirect URLs đã có trong `config.toml`.
Email vẫn dùng `SITE_URL` — local test email link nên set tạm:

```bash
# supabase/functions/.env
SITE_URL=http://localhost:8080
```
