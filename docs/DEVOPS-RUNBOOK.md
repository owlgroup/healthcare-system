# Runbook DevOps — Deploy Rcare Plus lên Supabase self-hosted

Tài liệu này hướng dẫn chạy image `rcare-supabase` để **đẩy migrations (SQL) và Edge Functions** lên Supabase self-hosted, và chạy image frontend `rcare-fe`. Không cần source code.

## Bên dev giao

| Thứ | Mô tả |
|---|---|
| `<registry>/rcare-supabase:<tag>` | Image chứa Edge Functions + SQL migrations (dựa trên `supabase/edge-runtime`) |
| `<registry>/rcare-fe:<tag>` | Image frontend (nginx) |
| `env.prod` | File env duy nhất cho mọi container (gửi qua kênh riêng — **chứa secret, không đưa vào git/chat**) |

Mỗi bản phát hành có tag riêng (vd. `a1b2c3d`) và đồng thời `:latest`.

## Cần chuẩn bị trên server Supabase

Lấy 4 thông tin sau từ stack Supabase self-hosted đang chạy:

| Thông tin | Cách tìm | Ví dụ |
|---|---|---|
| Network của stack | `docker network ls` hoặc Portainer → Networks | `supabase_default` |
| Thư mục functions trên host | Thư mục `volumes/functions` cạnh `docker-compose.yml` của stack | `/opt/supabase/docker/volumes/functions` |
| Tên container functions | `docker ps` | `supabase-edge-functions` |
| Mật khẩu Postgres | `POSTGRES_PASSWORD` trong `.env` của stack | — |

Chuỗi kết nối DB (dùng ở dưới):

```
postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/postgres
```

`db` là tên service Postgres trong stack (kiểm tra bằng `docker compose ps` nếu khác).

---

## Image `rcare-supabase` làm gì khi chạy

Theo thứ tự, mỗi lần container start:

1. **Migrations** — chạy các file SQL **chưa chạy** vào DB (theo thứ tự tên file). Mỗi file chạy trong 1 transaction và được ghi lại vào bảng `supabase_migrations.schema_migrations` (cùng bảng với Supabase CLI), nên file đã chạy sẽ bỏ qua. File lỗi → rollback file đó, container **dừng** với log `[rcare] ERROR: migration ... failed`.
2. **Vault secrets cho cron** — lưu URL gateway + service role key vào Vault để job nhắc lịch tiền khám (pg_cron, 15 phút/lần) gọi được function.
3. **Copy Edge Functions** vào `/home/deno/functions` (thư mục functions của stack). Chỉ thay các thư mục function của app; thư mục `main/` (router) của stack được giữ nguyên.
4. Chạy `edge-runtime` (giống image gốc `supabase/edge-runtime`) — **trừ khi** chạy với lệnh `deploy-only` thì dừng ở bước 3 và thoát.

Biến điều khiển (trong `env.prod`):

| Biến | Giá trị | Ý nghĩa |
|---|---|---|
| `MIGRATE` | `auto` (mặc định) | Chạy migration mới |
| | `baseline` | Chỉ đánh dấu mọi migration là đã chạy, **không** chạy SQL (xem mục Lần đầu) |
| | `skip` | Không đụng DB |
| `SUPABASE_DB_URL` | chuỗi kết nối ở trên | DB để chạy migration |
| `SUPABASE_URL` / `CRON_FUNCTIONS_BASE_URL` | `http://kong:8000` (stack cũ) hoặc `http://api-gw:8000` (stack mới) | Gateway mà DB gọi tới cho cron |
| `SUPABASE_SERVICE_ROLE_KEY` | key của stack | Cho cron |

---

## Cách A — Chạy 1 lần để đẩy migrations + functions (không sửa stack)

Phù hợp khi muốn giữ nguyên stack Supabase, mỗi bản phát hành chạy 1 lệnh.

### Bước 1. Pull image

```bash
docker pull <registry>/rcare-supabase:<tag>
```

### Bước 2. Chạy deploy

```bash
docker run --rm \
  --network supabase_default \
  --env-file ./env.prod \
  -e SUPABASE_DB_URL='postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/postgres' \
  -e SUPABASE_URL='http://kong:8000' \
  -v /opt/supabase/docker/volumes/functions:/home/deno/functions \
  <registry>/rcare-supabase:<tag> deploy-only
```

Thay `supabase_default`, đường dẫn volume, mật khẩu và `kong`/`api-gw` theo bảng "Cần chuẩn bị".

Log thành công:

```
[rcare] migrations done (auto): 3 new
[rcare] vault secrets for cron updated (url=http://kong:8000)
[rcare] functions synced to /home/deno/functions: 29 function(s)
[rcare] deploy-only: done — restart the stack's functions container to load new code
```

Exit code khác 0 → **dừng lại, không làm bước 3**, đọc log (xem mục Xử lý lỗi).

### Bước 3. Restart container functions của stack

```bash
docker restart supabase-edge-functions
```

Bước 2 cần đọc/ghi volume functions và kết nối DB, nên phải chạy **trên cùng server** với stack Supabase.

### Trên Portainer (không dùng CLI)

Containers → **Add container**:

- Image: `<registry>/rcare-supabase:<tag>`
- Command & logging → Command: `deploy-only`
- Volumes → Bind: host `/opt/supabase/docker/volumes/functions` → container `/home/deno/functions`
- Network: `supabase_default`
- Env → *Load variables from .env file* → `env.prod`; thêm `SUPABASE_DB_URL`, `SUPABASE_URL`
- Restart policy: **Never**

Deploy → xem Logs đến dòng `deploy-only: done` → xoá container này → Restart container `supabase-edge-functions`.

---

## Cách B — Thay image của service `functions` (tự động mỗi lần update)

Phù hợp khi muốn phát hành = đổi tag / bấm Update stack / webhook, không chạy lệnh tay.

### Cấu hình 1 lần

Portainer → Stacks → stack Supabase → Editor, sửa service `functions`:

```yaml
functions:
  image: <registry>/rcare-supabase:latest     # thay cho supabase/edge-runtime:vX
  pull_policy: always
  # GIỮ NGUYÊN command, volumes, healthcheck, depends_on, environment sẵn có
  env_file:
    - stack.env                               # = env.prod (Load variables from .env file)
```

Stack Supabase đã truyền sẵn `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` cho service `functions`; các biến trong `environment:` ưu tiên hơn `env_file` nên không bị ghi đè. Thiếu `SUPABASE_DB_URL` thì thêm vào `environment:`.

Update the stack. Từ đây mỗi lần container `functions` được recreate, nó tự chạy migration mới + nạp function mới (bước 1–4 ở trên), **không cần restart thêm**.

### Mỗi lần phát hành

Một trong ba:

- Bên dev gọi **webhook** Portainer của stack (bật ở stack → Webhook, chọn *Re-pull image*) — không phải làm gì.
- Stack → **Update the stack** → bật *Re-pull image and redeploy*.
- Đổi tag `rcare-supabase:<tag>` trong Editor → Update.

---

## Env cho `functions` và `auth` (cả 2 cách)

Code function do image cung cấp, nhưng **env của function vẫn phải có ở service `functions` của stack**, env GoTrue ở service `auth`. Dùng luôn `env.prod`:

```yaml
functions:
  env_file: [stack.env]
auth:
  env_file: [stack.env]
```

Sau khi đổi env: Recreate `functions` rồi `auth`.

Kiểm tra trong `env.prod`:

- `SEND_EMAIL_HOOK_SECRET` **giống hệt** `GOTRUE_HOOK_SEND_EMAIL_SECRETS` (lệch → email OTP lỗi 401).
- Host trong `GOTRUE_HOOK_SEND_EMAIL_URI` là gateway của stack (`kong` hoặc `api-gw`).
- `VERIFY_JWT=false`.
- Không có comment cùng dòng với giá trị (`VAR=x # ...`).

## Frontend `rcare-fe`

```yaml
services:
  rcare-fe:
    image: <registry>/rcare-fe:<tag>
    ports: ["80:80"]
    env_file: [stack.env]                     # = env.prod
    restart: unless-stopped
```

Container chỉ đưa các biến `VITE_*` ra trình duyệt (`/env-config.js`). Đổi env → Recreate, không cần image mới. Deploy FE **sau** khi migration đã chạy xong.

---

## Lần đầu trên DB đã có dữ liệu

Nếu DB trước đây được tạo bằng cách chạy SQL tay (không qua Supabase CLI), lần chạy đầu sẽ lỗi ngay ở file đầu tiên kiểu:

```
ERROR:  relation "patient_identity" already exists
[rcare] ERROR: migration 20260209133000_create_patient_onboarding failed
```

Khi đó (chỉ khi **chắc chắn** DB đã có đủ mọi migration của bản này — hỏi bên dev):

1. Chạy 1 lần với `-e MIGRATE=baseline` (Cách A) hoặc đặt `MIGRATE=baseline` rồi Recreate (Cách B). Log: `migrations done (baseline): N new`.
2. Đổi lại `MIGRATE=auto` cho các lần sau.

## Kiểm tra sau deploy

| Kiểm tra | Kỳ vọng |
|---|---|
| Log `rcare-supabase` / `functions` | `migrations done`, `functions synced ... 29 function(s)` |
| `curl -i -X OPTIONS https://<supabase-host>/functions/v1/portal-login` | `204` hoặc `200`, có header CORS |
| `curl http://<fe-host>/env-config.js` | `window.__ENV__ = { "VITE_SUPABASE_URL": ... }` |
| Trên FE: đăng ký tài khoản mới | Nhận email OTP 6 số |
| SQL: `select jobname from cron.job;` | Có `pre-consult-reminder-scan-every-15min` |
| SQL: `select version from supabase_migrations.schema_migrations order by version desc limit 3;` | Version mới nhất của bản phát hành |

## Xử lý lỗi

| Log / hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `database not reachable` | Chưa join network stack, sai host/mật khẩu | Kiểm tra `--network`, `SUPABASE_DB_URL` |
| `SUPABASE_DB_URL is not set` | Thiếu biến | Thêm biến, hoặc `MIGRATE=skip` nếu chỉ muốn nạp function |
| `migration ... failed` + `already exists` | DB đã migrate tay | Mục "Lần đầu" |
| `migration ... failed` lỗi khác | SQL lỗi trên DB này | Gửi log cho bên dev; file lỗi đã rollback, DB không bị dở dang |
| `could not write vault secrets` | DB thiếu extension `vault` | Cron nhắc lịch không chạy; báo bên dev |
| Function vẫn chạy code cũ (Cách A) | Chưa restart | `docker restart supabase-edge-functions` |
| Function vẫn code cũ (Cách B) | Portainer không pull image mới | Bật *Re-pull image* / `pull_policy: always` |
| Không nhận email OTP, log `auth-send-email` 401 | Lệch secret hook / sai host gateway / `VERIFY_JWT` | Mục "Env cho functions và auth" |

## Rollback

- **Function / FE**: chạy lại với tag cũ (Cách A: `docker run ... rcare-supabase:<tag-cũ> deploy-only` + restart; Cách B: đổi tag cũ → Update).
- **Migration**: **không** tự rollback. Migration đã chạy vẫn giữ nguyên; tag cũ chỉ bỏ qua chúng. Cần đảo ngược thì bên dev cung cấp SQL riêng.
