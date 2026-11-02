# FR-002 — Đăng nhập đa Portal

## Portal URLs (AC1)

| Portal | Login | Home |
|--------|-------|------|
| Patient | `/patient/login` | `/home` |
| Doctor | `/doctor/login` | `/provider-portal` |
| Admin | `/admin/login` | `/admin` |

Legacy `/login` → redirect `/patient/login`.

## JWT & refresh (AC2)

| Role | Access TTL |
|------|------------|
| patient | 60 phút |
| doctor | 30 phút |
| admin | 15 phút |

Refresh token: **7 ngày** (Supabase Auth mặc định + rotation).

Custom Access Token Hook: `public.custom_access_token_hook` — set `exp` và claim `user_role`.

## Edge functions

- `portal-login` — validate portal, lock 5 fails / 15 min, audit, role check
- `portal-logout` — revoke refresh token + audit `LOGOUT`

## Database

- `user_profiles` — `user_id`, `email`, `role` (`patient`|`doctor`|`admin`)
- `audit_logs.user_agent` — AC5

Signup tự gán `role = patient`. Doctor/Admin: cập nhật trong Supabase Table Editor hoặc SQL:

```sql
UPDATE public.user_profiles SET role = 'doctor' WHERE email = 'doctor@clinic.com';
```

## Deploy

```bash
supabase db push
npm run supabase:deploy-functions
supabase config push --yes
```
