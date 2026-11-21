# Deploy production — Rcare Plus (2 image + Portainer webhook)

DevOps nhận **2 image** trên registry + **1 file env** (`env.prod`, gửi riêng, không có trong git). Không cần source code.

| Image | Nội dung | Chạy ở đâu |
|---|---|---|
| `rcare-fe` | Frontend (nginx + bundle đã build) | Container / stack riêng |
| `rcare-supabase` | Edge Functions + SQL migrations (dựa trên `supabase/edge-runtime`) | **Thay image** của service `functions` trong stack Supabase self-hosted |

Sau khi DevOps cấu hình 1 lần (mục 1–3), mỗi lần phát hành dev chỉ chạy:

```bash
./scripts/release.sh
```

Script build 2 image → push lên registry → gọi webhook Portainer. Portainer pull image mới và recreate container: `rcare-supabase` tự chạy migration mới + nạp function mới, `rcare-fe` lên bản mới. Không cần mở thêm port nào trên server.

---

## Env

`env.prod` chia 3 nhóm (xem [`env.prod.example`](../env.prod.example)):

| Nhóm | Đưa vào | Khi đổi giá trị |
|---|---|---|
| `[1]` `VITE_*` | container `rcare-fe` | Recreate `rcare-fe` |
| `[2]` `MIGRATE`, SMTP, `*_SECRET`, `SITE_URL`, `VERIFY_JWT`, `UPSTASH_*` | service `functions` (image `rcare-supabase`) | Recreate `functions` |
| `[3]` `GOTRUE_*`, `API_EXTERNAL_URL` | service `auth` (image gốc của Supabase) | Recreate `auth` |

**Ràng buộc:** `SEND_EMAIL_HOOK_SECRET` `[2]` phải giống hệt `GOTRUE_HOOK_SEND_EMAIL_SECRETS` `[3]`. Lệch → email OTP lỗi 401.

**Dùng chung 1 file:** có thể nạp nguyên `env.prod` cho cả 3 service thay vì tách 3 file — mỗi service chỉ đọc biến của mình, biến thừa bị bỏ qua. `rcare-fe` chỉ đưa `VITE_*` ra trình duyệt (`/env-config.js`), secret khác không lộ ra web.

- Trên Portainer: Stack → *Environment variables* → **Load variables from .env file** → chọn `env.prod`. Portainer lưu thành `stack.env`; trong compose dùng `env_file: [stack.env]` cho `rcare-fe`, `functions`, `auth`.
- Biến khai báo trong `environment:` của stack **ưu tiên hơn** `env_file`, nên các biến stack Supabase tự đặt (`SUPABASE_URL`, `SUPABASE_DB_URL`, ...) không bị ghi đè.
- Đánh đổi: container `rcare-fe` (public) cũng giữ các secret server trong env. Muốn chặt hơn thì tách nhóm `[1]` ra file riêng cho FE.

---

## 1. Stack Supabase — service `functions` dùng `rcare-supabase` (DevOps, 1 lần)

Portainer → Stacks → stack Supabase → Editor, sửa service `functions`:

```yaml
functions:
  image: <registry>/rcare-supabase:latest     # thay cho supabase/edge-runtime:vX
  pull_policy: always
  # giữ nguyên command, volumes, healthcheck, depends_on, environment sẵn có của stack
  env_file:
    - ./functions.env                         # = nhóm [2]
```

Image dùng các biến mà stack Supabase đã truyền sẵn cho `functions`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`. Thiếu biến nào thì thêm vào `functions.env`.

Khi container start, image tự làm theo thứ tự:

1. **Migrations** (`MIGRATE=auto`): chạy file SQL chưa chạy vào `SUPABASE_DB_URL`, mỗi file 1 transaction, ghi lại vào `supabase_migrations.schema_migrations` (cùng bảng với `supabase db push`). File lỗi → rollback file đó, container dừng với log `[rcare] ERROR: migration ... failed`.
2. **Vault secrets** cho cron nhắc tiền khám (`supabase_project_url`, `supabase_service_role_key`), lấy từ `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. **Nạp functions** vào `/home/deno/functions`. Chỉ thay thư mục của app; router `main/` của stack giữ nguyên (không có thì dùng router đi kèm image).
4. Chạy `edge-runtime` như image gốc.

Log bình thường:

```
[rcare] migrations done (auto): N new
[rcare] vault secrets for cron updated (url=http://kong:8000)
[rcare] functions synced to /home/deno/functions: 29 function(s)
```

**Lần đầu trên DB đã migrate bằng tay** (không qua `supabase db push`): nếu lỗi `relation ... already exists` ở file đầu tiên, đặt `MIGRATE=baseline` → Recreate 1 lần (chỉ đánh dấu, không chạy SQL) → đổi lại `MIGRATE=auto`. Chỉ làm khi chắc chắn DB đã có đủ mọi migration trong image.

Yêu cầu DB: extension `pg_cron`, `pg_net`, `vault` (có sẵn trong image `supabase/postgres`). `VERIFY_JWT=false` vì hook `auth-send-email` do GoTrue gọi không kèm JWT; các function cần đăng nhập tự kiểm tra token.

## 2. Stack Supabase — service `auth` (DevOps, 1 lần)

```yaml
auth:
  env_file:
    - ./auth.env                              # = nhóm [3]
```

- Host trong `GOTRUE_HOOK_SEND_EMAIL_URI` là gateway của stack: `http://kong:8000/...` (stack cũ) hoặc `http://api-gw:8000/...` (stack mới) — cùng host với `SUPABASE_URL` của `functions`.
- `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `SITE_URL`, `VITE_SITE_URL` cùng domain production của FE.
- Không viết comment cùng dòng với giá trị.

## 3. Container `rcare-fe` (DevOps, 1 lần)

```yaml
services:
  rcare-fe:
    image: <registry>/rcare-fe:latest
    pull_policy: always
    ports: ["80:80"]
    env_file: [./fe.env]                      # = nhóm [1]
    restart: unless-stopped
```

Khi start, `docker/env-config.sh` ghi các `VITE_*` thành `/env-config.js`. Chỉ đưa nhóm `[1]` vào đây — `/env-config.js` ai cũng tải được.

## 4. Webhook Portainer (DevOps, 1 lần)

Bật webhook cho **stack Supabase** (hoặc riêng service `functions`) và cho **rcare-fe**, rồi gửi 2 URL webhook cho dev:

- **Swarm service**: Services → chọn service → bật *Service webhook* → copy URL.
- **Stack**: Stacks → chọn stack → *Create a Stack webhook* / *GitOps updates → Webhook* (tùy phiên bản Portainer; một số bản cần Business Edition), bật *Re-pull image*.
- **Container đơn** (Portainer không có webhook): dùng stack 1 service thay cho container.

Webhook phải pull lại image (`:latest` + *re-pull* / `pull_policy: always`), nếu không Portainer sẽ recreate bằng image cũ trong cache.

Không bật được webhook → mỗi lần phát hành DevOps vào stack bấm **Update the stack** + *Re-pull image* (vẫn không cần source).

## 5. Phát hành (dev)

Tạo `scripts/release.env` (đã git-ignore):

```sh
REGISTRY=<registry>/rcare
PORTAINER_WEBHOOK_SUPABASE=https://<portainer>/api/stacks/webhooks/<id>
PORTAINER_WEBHOOK_FE=https://<portainer>/api/stacks/webhooks/<id>
```

```bash
docker login <registry>
./scripts/release.sh            # tag = git commit ngắn, kèm :latest
./scripts/release.sh v1.2.0     # hoặc tag tự đặt
```

Thứ tự: build 2 image → push `:<tag>` + `:latest` → gọi webhook `rcare-supabase` (migration chạy trước) → gọi webhook `rcare-fe`.

Không có registry: `docker save <registry>/rcare-fe:<tag> <registry>/rcare-supabase:<tag> | gzip > rcare-<tag>.tar.gz` → DevOps `docker load -i ...` rồi Update stack.

Không image nào chứa `.env` / secret (`.dockerignore` loại `**/.env*`, `env.prod`).

## 6. Kiểm tra sau deploy

| Kiểm tra | Kỳ vọng |
|---|---|
| Portainer: `rcare-fe` | `healthy` |
| Log `functions` | `migrations done`, `functions synced ... 29 function(s)` |
| `curl http://<fe-host>/env-config.js` | `window.__ENV__ = { "VITE_SUPABASE_URL": ... }` |
| `curl -i -X OPTIONS https://<supabase-host>/functions/v1/portal-login` | `204`/`200`, có header CORS |
| Đăng ký tài khoản mới | Nhận email OTP 6 số |
| Quên mật khẩu | Nhận OTP, đặt lại được |
| Đăng nhập admin → quản lý user | Không 401/403 |
| `select jobname from cron.job;` | Có `pre-consult-reminder-scan-every-15min` |

## 7. Lỗi thường gặp

- **`functions` restart liên tục**: xem log. `migration ... failed` → sửa DB hoặc `baseline` (mục 1). `SUPABASE_DB_URL is not set` → thêm biến, hoặc `MIGRATE=skip`. `database not reachable` → `db` chưa healthy / sai URL.
- **Webhook chạy nhưng vẫn bản cũ**: Portainer không re-pull image — bật *Re-pull image* / `pull_policy: always`.
- **Không nhận email OTP**: log `functions` + `auth`. 401 ở `auth-send-email` = lệch secret hook, sai host gateway, hoặc `VERIFY_JWT` chưa `false`. Lỗi SMTP = sai `SMTP_USER`/`SMTP_PASS`.
- **Redirect sai domain**: sai `GOTRUE_SITE_URL` / `GOTRUE_URI_ALLOW_LIST` / `SITE_URL`.
- **FE gọi sai Supabase / trắng trang**: xem `/env-config.js`, sửa env `rcare-fe` → Recreate.
- **Rollback**: trỏ stack về tag cũ (`rcare-supabase:<tag-cũ>`, `rcare-fe:<tag-cũ>`). Function quay về bản cũ, nhưng migration đã chạy **không** tự rollback — cần SQL đảo ngược riêng.
