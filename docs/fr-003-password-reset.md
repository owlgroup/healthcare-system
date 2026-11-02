# FR-003 — Quên mật khẩu / Reset

## Luồng

1. `/forgot-password` — nhập email → `forgot-password-send-otp`
2. Nhập OTP → `forgot-password-verify-otp` → `reset_token` (JWT 10 phút, single-use)
3. Mật khẩu mới → `reset-password-complete`

## Acceptance criteria

| AC | Triển khai |
|----|------------|
| AC1 | Edge luôn trả 200 + message chung; chỉ gửi OTP server-side nếu user tồn tại |
| AC2 | `signResetToken` + Redis `reset_token:used:{jti}` khi complete |
| AC3 | Bảng `password_history`, so sánh 3 hash gần nhất (bcrypt) |
| AC4 | `signOutAllSessions(userId, 'global')` sau reset |
| AC5 | `audit_logs.event_type = 'PASSWORD_RESET'` |

## Deploy

```bash
supabase db push
npm run supabase:deploy-functions
```

## Bảng mới

- `password_history` — `user_id`, `password_hash`, `created_at`
- `audit_logs` — `event_type`, `user_id`, `email`, `metadata`
