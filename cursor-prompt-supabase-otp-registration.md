# Cursor Prompt — Luồng Đăng Ký 3 Bước (Email → OTP → Password)

## Ngữ cảnh dự án

Tôi đang xây dựng ứng dụng đặt lịch khám bệnh online (Next.js 14 App Router + Supabase + Upstash Redis + TypeScript). Hãy implement tính năng **đăng ký tài khoản bệnh nhân** theo đúng spec dưới đây. Code phải production-ready, có error handling đầy đủ, không để lộ logic bảo mật ra client.

---

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, React Hook Form + Zod
- **Backend**: Supabase (Auth + PostgreSQL), Supabase Edge Functions
- **Cache/Rate-limit**: Upstash Redis (REST API)
- **Email**: Supabase Auth built-in SMTP (hoặc Resend nếu cần custom template)

---

## Business Rules (bắt buộc, không được bỏ qua)

| Rule | Spec |
|------|------|
| OTP TTL | 5 phút, lưu hash trong Redis |
| OTP format | 6 chữ số ngẫu nhiên |
| OTP attempts | Sai 3 lần → khóa gửi OTP cho email đó 5 phút |
| Password | ≥8 ký tự, ít nhất 1 chữ hoa, ít nhất 1 chữ số |
| Password storage | bcrypt cost 12, KHÔNG lưu plain text |
| Duplicate email | Trả 409 + gợi ý đăng nhập / quên mật khẩu |
| Temp token | Sau verify OTP thành công → cấp `temp_token` (JWT, exp 10p, scope: `set_password`) |
| Post-register | Tự động đăng nhập, redirect đến `/onboarding/profile` |

---

## Yêu cầu triển khai

### 1. Database / Supabase setup

Tạo file `supabase/migrations/001_registration.sql`:

```sql
-- Bảng theo dõi trạng thái đăng ký (trước khi user chính thức tạo)
CREATE TABLE pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: chỉ service_role được insert/select
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
```

Supabase Auth settings cần set:
- OTP expiry: `300` giây (5 phút)
- Enable email confirmations: `true`

---

### 2. Upstash Redis Keys Convention

```
otp:hash:{email}          → bcrypt hash của OTP, TTL 300s
otp:attempt:{email}       → số lần sai (integer), TTL 300s
otp:lock:{email}          → giá trị "1" nếu đang bị khóa, TTL 300s
temp_token:used:{jti}     → "1" nếu token đã dùng (prevent replay), TTL 600s
```

---

### 3. API Routes cần tạo (Next.js App Router)

#### `POST /api/auth/register/send-otp`

**Request body:**
```typescript
{ email: string }
```

**Logic:**
1. Validate email format (Zod)
2. Kiểm tra `otp:lock:{email}` trong Redis → nếu tồn tại, trả 429 kèm `retryAfter` (seconds còn lại)
3. Query Supabase: kiểm tra email đã tồn tại trong `auth.users` chưa
   - Nếu có → trả `{ status: 409, error: "EMAIL_EXISTS", message: "Tài khoản đã tồn tại", suggestions: ["login", "forgot_password"] }`
4. Sinh OTP: `crypto.randomInt(100000, 999999).toString()`
5. Hash OTP bằng bcrypt (cost 10 — đủ nhanh cho OTP ngắn hạn)
6. Lưu Redis: `SET otp:hash:{email} {hash} EX 300`
7. Gửi email qua Supabase Auth `signInWithOtp` hoặc Resend
8. Trả `{ status: 200, message: "OTP đã gửi", expiresIn: 300 }`

**Response errors:**
```typescript
429 → { error: "OTP_LOCKED", retryAfter: number }  // seconds
409 → { error: "EMAIL_EXISTS", suggestions: string[] }
422 → { error: "INVALID_EMAIL" }
500 → { error: "SEND_FAILED" }
```

---

#### `POST /api/auth/register/verify-otp`

**Request body:**
```typescript
{ email: string; otp: string }
```

**Logic:**
1. Validate input
2. Kiểm tra `otp:lock:{email}` → nếu bị khóa, trả 429
3. Lấy `otp:hash:{email}` từ Redis → nếu không có, trả 410 (expired)
4. `bcrypt.compare(otp, hash)`:
   - **Sai**: 
     - `INCR otp:attempt:{email}` (với `EXPIRE 300` nếu key mới)
     - Nếu attempts ≥ 3: `SET otp:lock:{email} 1 EX 300`, xóa OTP hash, trả 429
     - Còn lại: trả 400 kèm `{ attemptsLeft: 3 - attempts }`
   - **Đúng**:
     - Xóa `otp:hash:{email}`, `otp:attempt:{email}`
     - Tạo `temp_token`: JWT với `{ sub: email, scope: "set_password", jti: uuid() }`, ký bằng `TEMP_TOKEN_SECRET`, exp 10p
     - Trả `{ status: 200, tempToken: string, expiresIn: 600 }`

**Response errors:**
```typescript
400 → { error: "INVALID_OTP", attemptsLeft: number }
410 → { error: "OTP_EXPIRED" }
429 → { error: "OTP_LOCKED", retryAfter: number }
```

---

#### `POST /api/auth/register/set-password`

**Request body:**
```typescript
{ tempToken: string; password: string }
```

**Logic:**
1. Verify JWT `temp_token`:
   - Kiểm tra `temp_token:used:{jti}` trong Redis → nếu có, trả 409 (replay)
   - Kiểm tra `scope === "set_password"` và chưa expired
2. Validate password (Zod regex):
   - ≥8 ký tự
   - Ít nhất 1 chữ hoa `[A-Z]`
   - Ít nhất 1 chữ số `[0-9]`
3. Hash password: `bcrypt.hash(password, 12)`
4. Tạo user Supabase (service_role):
   ```typescript
   supabase.auth.admin.createUser({
     email,
     password: hashedPassword, // Supabase sẽ hash lại → dùng raw password ở đây, xem note bên dưới
     email_confirm: true,
   })
   ```
   > **Lưu ý quan trọng**: Supabase tự hash password khi dùng `createUser`. Truyền `password` gốc vào — KHÔNG truyền bcrypt hash. Supabase dùng bcrypt cost 10 nội bộ. Nếu bắt buộc cost=12, phải bypass Supabase Auth và tự quản lý bảng users riêng với Postgres function.
5. Đánh dấu `temp_token` đã dùng: `SET temp_token:used:{jti} 1 EX 600`
6. Gọi `supabase.auth.signInWithPassword({ email, password })` để lấy session
7. Trả `{ status: 201, session: { accessToken, refreshToken } }`

**Response errors:**
```typescript
400 → { error: "WEAK_PASSWORD", rules: string[] }  // rules bị vi phạm
401 → { error: "INVALID_TEMP_TOKEN" }
409 → { error: "TOKEN_ALREADY_USED" }
409 → { error: "EMAIL_EXISTS" }  // race condition
```

---

### 4. Frontend Components cần tạo

#### `app/(auth)/register/page.tsx`
- Stepper UI hiển thị 3 bước: **Email → Xác thực OTP → Tạo mật khẩu**
- State machine đơn giản: `step: 'email' | 'otp' | 'password'`
- Lưu `email` và `tempToken` trong component state (không dùng localStorage)

#### `components/auth/EmailStep.tsx`
- Form: 1 input email + button "Gửi mã OTP"
- Show loading state khi đang gửi
- Xử lý lỗi 409: hiển thị banner "Tài khoản đã tồn tại" + 2 nút "Đăng nhập" / "Quên mật khẩu"
- Xử lý lỗi 429: hiển thị countdown timer

#### `components/auth/OtpStep.tsx`
- 6 ô input riêng biệt (auto-focus next on input, handle backspace)
- Countdown timer 5 phút, hiện nút "Gửi lại OTP" khi hết giờ
- Hiển thị `attemptsLeft` khi nhập sai
- Hiển thị thông báo bị khóa khi 429

#### `components/auth/PasswordStep.tsx`
- 2 input: mật khẩu + xác nhận mật khẩu
- **Inline validation realtime** (onChange, không đợi submit):
  - `[ ] ≥ 8 ký tự` → xanh khi đạt
  - `[ ] Có chữ hoa` → xanh khi đạt
  - `[ ] Có chữ số` → xanh khi đạt
- Toggle show/hide password
- Button disabled cho đến khi tất cả rules pass + 2 passwords khớp

---

### 5. Middleware / Route Protection

File `middleware.ts`:
- `/onboarding/*` → redirect về `/register` nếu không có session Supabase hợp lệ
- `/register` → redirect về `/dashboard` nếu đã có session

---

### 6. Environment Variables cần thêm

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Chỉ dùng server-side

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

TEMP_TOKEN_SECRET=                # ≥32 chars random string, dùng để sign JWT
```

---

### 7. Validation Schema (Zod)

```typescript
// lib/validations/auth.ts

export const emailSchema = z.object({
  email: z.string().email("Email không hợp lệ").toLowerCase(),
})

export const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6).regex(/^\d{6}$/, "OTP phải là 6 chữ số"),
})

export const passwordSchema = z.object({
  tempToken: z.string().min(1),
  password: z
    .string()
    .min(8, "Ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Phải có ít nhất 1 chữ hoa")
    .regex(/[0-9]/, "Phải có ít nhất 1 chữ số"),
})
```

---

### 8. File structure mong đợi sau khi implement

```
app/
  (auth)/
    register/
      page.tsx                  ← Stepper container
  api/
    auth/
      register/
        send-otp/route.ts
        verify-otp/route.ts
        set-password/route.ts

components/
  auth/
    EmailStep.tsx
    OtpStep.tsx
    PasswordStep.tsx
    PasswordRules.tsx           ← Inline validation checklist

lib/
  redis.ts                      ← Upstash Redis client singleton
  supabase/
    server.ts                   ← Supabase server client (service_role)
    client.ts                   ← Supabase browser client
  validations/
    auth.ts                     ← Zod schemas

middleware.ts
```

---

### 9. Acceptance Criteria Checklist (dùng để test)

- [ ] **AC1**: Gửi email mới → OTP đến trong ≤10s
- [ ] **AC2**: OTP đúng → nhận `temp_token` trong response
- [ ] **AC3**: Password field validate realtime, mỗi rule có indicator riêng
- [ ] **AC4**: Đăng ký thành công → JWT trong cookie, redirect `/onboarding/profile`
- [ ] **AC5**: Nhập sai OTP 3 lần → tất cả request tiếp theo với email đó bị 429 trong 5p
- [ ] **AC6**: Email đã tồn tại → 409 + hiện 2 nút gợi ý
- [ ] **AC7**: Redis key `otp:hash:{email}` tự xóa sau 5p
- [ ] **AC8**: Không có plain text password trong logs, DB, hay Redis

---

### 10. Lưu ý bảo mật (không được bỏ qua)

1. **Timing attack**: Luôn dùng `bcrypt.compare` thay vì `===` khi so sánh OTP
2. **Log sanitization**: Không log email hay OTP ra console trong production
3. **CORS**: Các route `/api/auth/*` chỉ chấp nhận request từ cùng origin
4. **Rate limit global**: Thêm rate limit IP-based (10 requests/phút) ở middleware, ngoài việc lock per-email
5. **temp_token single-use**: Dùng Redis để đánh dấu jti đã dùng, prevent replay attack
6. **HTTPS only**: Set cookie `Secure; HttpOnly; SameSite=Strict` khi lưu session

---

Hãy bắt đầu từ bước nào bạn muốn, hoặc implement toàn bộ theo thứ tự: **Redis client → API routes → Frontend components**.
