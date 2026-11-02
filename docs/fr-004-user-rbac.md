# FR-004 — User CRUD + Dynamic RBAC

Admin quản lý user và role động. Permissions được kiểm tra trên edge functions admin.

## Database

Migration: `supabase/migrations/20260225160000_dynamic_rbac.sql`

| Bảng | Mô tả |
|------|--------|
| `facilities` | Cơ sở y tế |
| `permissions` | Slug quyền (users.read, roles.create, …) |
| `roles` | System + custom roles (`is_system`, `portal_role`) |
| `role_permissions` | Gán permission cho role |
| `user_profiles` | Thêm `full_name`, `phone`, `facility_id`, `specialty`, `status`, `role_id` |

System roles (không xóa): `patient`, `doctor`, `admin`.

## Edge functions

| Function | Quyền |
|----------|-------|
| `admin-users` | list/get → `users.read`; create → `users.create`; update → `users.update`; delete → `users.delete`; reset_password → `users.reset_password` |
| `admin-roles` | list/permissions → `roles.read`; create → `roles.create`; update → `roles.update`; delete → `roles.delete` |

Middleware: `supabase/functions/_shared/rbac.ts` → `requirePermission(req, slug)`.

## Acceptance criteria

| AC | Triển khai |
|----|------------|
| AC1 | CRUD user: tên, email, SĐT, role, facility, specialty (doctor), status |
| AC2 | Role custom + checkbox permissions; user nhận quyền qua `role_id` |
| AC3 | `requirePermission` trên mọi action admin API |
| AC4 | `is_system` + slug patient/doctor/admin → 403 khi xóa |
| AC5 | Đếm user theo `role_id` → 409 + gợi ý chuyển role |
| AC6 | So sánh `auth.userId` với target → 403 self lock/delete |
| AC7 | `generateTempPassword(12)` + email recover + hiển thị temp 1 lần cho admin |
| AC8 | Audit: USER_*, ROLE_*, ADMIN_PASSWORD_RESET |

## Deploy

```bash
npm run supabase:db-push
npm run supabase:deploy-functions
```

## Gán admin cho user hiện có

```sql
UPDATE user_profiles up
SET role_id = r.id, role = 'admin'
FROM roles r
WHERE r.slug = 'admin' AND up.email = 'admin@example.com';
```

## Frontend

- `/admin` → sidebar **Users** / **Roles**
- API client: `src/lib/admin-api.ts` (JWT session)

## Ghi chú email AC7

Supabase gửi email recovery (không plaintext password). Admin UI hiển thị mật khẩu tạm một lần để copy. Tùy chỉnh template SMTP nếu cần gửi plaintext qua email provider riêng.
