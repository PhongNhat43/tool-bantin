# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 20/10/2026 (sau Task 3.4 một phần — workflow deploy GitHub Pages đã viết, chờ Phong bật Pages/secrets)_

## Đang ở đâu
- **Phase 0: xong** — Supabase project, schema 3 bảng, git + GitHub, Telegram bot + group nhận tin
- **Phase 1:**
  - [x] 1.1 `_shared/` (types, keywords, normalize) + patch 1.1b (NEGATIVE_EXCEPTIONS)
  - [x] 1.2 github-collector + patch 1.2b (GITHUB_TOKEN, move schema.sql)
  - [x] 1.4 hackernews-collector
  - [x] 1.5 rss-collector + `_shared/xml.ts` (parser tự viết — Deno không có DOMParser) — commit `e0510af`
  - [x] 1.5b tách `github-collector` + `hackernews-collector` thành `collector.ts` (logic) + `index.ts` (entrypoint) — đóng cảnh báo #33 — commit `da64117` + `241dd4f`
  - [x] 1.6 ingest-facebook — endpoint POST nhận JSON từ Merlin (3 group FB đã seed; auth `x-ingest-secret`) — commit `dba3082` — **Merlin đã bắn dữ liệu thật (48 item FB trong DB)**
  - [ ] 1.3 reddit-collector — DỜI CUỐI Phase 1 (chờ quyết định phê duyệt API Reddit)
- **Phase 2:** final plan đã chốt 19/10 — chi tiết scoring đầy đủ + orchestrator `run-cycle` nằm ở **AGENTS.md mục 6**.
  - [x] 2.1 `_shared/scoring.ts` — lib thuần túy (không DB/mạng): cổng T2, topic 0–40, engagement nội suy 0–30, recency 6/12/24/48h 0–20, cross-source 0–10, 3 luật `notify_now` a/b/c + `notify_reason`. Commit `79485ce`; **11 test offline**.
  - [x] 2.2 `_shared/notify.ts` — `sendInstant` (≥70/trigger, preview bật) + `sendDigest` (40–69, 1 tin/lô, preview tắt); chống trùng `notification_log`; chỉ log khi Telegram `ok:true`; escape HTML, cắt tiêu đề 150, digest >4096 → `…và N tin khác`. Commit `5e3e9de`; **9 test offline**; đã gửi thật vào group "Bản tin AI". Xem DECISIONS #40/#41.
  - [x] 2.0 `run-cycle` — orchestrator duy nhất: đọc `sources` enabled → `collectSource` theo type (mỗi source try/catch; facebook bỏ qua) → chấm tối đa 200 item/kỳ kèm cross-source 24h → ghi `score` + `engagement.score_breakdown` → notify (<48h; ≥70/trigger instant, 40–69 digest). Commit `4be1a82`; đã deploy + kiểm tra auth 401. Xem DECISIONS #42–#44.
  - [x] 2.0b Fix test RSS flaky — fixture thật `rss-collector/testdata/feed.xml` + mock fetch cho feed Simon; chạy 10 lần 10/10 pass. Commit `bfcad05`; không đổi logic collector.
  - [x] 2.1b `supabase/config.toml` tối thiểu (`verify_jwt=false` cho ingest-facebook + run-cycle); xoá `.bak`; deploy **không flag** + verify sai secret → JSON 401 của code. Commit `1e42c2c`; DECISIONS #45.
  - [x] 2.3 pg_cron + pg_net + Vault — migration `20261020_run_cycle_cron.sql`, wrapper `public.trigger_run_cycle()`, job `run-cycle-2h` lịch `0 */2 * * *`. **Phong đã chạy SQL**: `cron.job` có `run-cycle-2h` active, `net._http_response` có kết quả 200. Xem DECISIONS #46.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).
  - [x] 3.1 Scaffold Next.js 16 trong `dashboard/`: App Router, TypeScript, không src-dir; magic link; RLS SELECT `authenticated`; trang chủ tạm 10 item mới nhất. Đã test E2E thật (mail.tm). Xem DECISIONS #47. **Phần server (`proxy.ts`, `@supabase/ssr`, Server Component, Route Handler) đã bị 3.1b gỡ bỏ.**
  - [x] 3.1b **Chuyển dashboard sang static export cho GitHub Pages** (thay Vercel): `output: "export"` + `trailingSlash` + `basePath=/tool-bantin`; `RequireAuth` (client) chặn route private; `/login` + `/auth/callback` client (PKCE, fallback hash token); trang chủ fetch client; bỏ `@supabase/ssr`. Build ra `out/`, đã test serve tĩnh + login + logout. Commit `d0b5ab0`. Xem DECISIONS #48/#49.
  - [x] 3.2 Trang Feed đúng demo, client-side: 3 khối (Cần xem ngay ≥70 max 20 / Hôm nay 40–69 trong 24h max 30 / Tất cả + search title+content + lọc nguồn + Tải thêm 50), dòng Feedly (ô điểm vuông + tiêu đề/meta, expand: nội dung 500 ký tự + breakdown 4 thành phần + engagement gốc + link gốc), theme light mặc định + toggle dark (localStorage, không nháy), header sticky + nút "Chạy ngay". Commit `ec8817f`. Xem DECISIONS #50/#51.
  - [x] 3.3 Trang Nguồn, client-side: mỗi nguồn 1 dòng (tên, badge loại, tóm tắt config dạng `key: value`, số item, toggle bật/tắt có loading + lỗi riêng); form thêm nguồn field động (github/hackernews/rss) validate client rồi insert, reload list + báo thành công; facebook read-only kèm ghi chú nguồn bị động. Migration `20261021_sources_write.sql` (policy INSERT/UPDATE + grant). Commit `7c8f888`. Xem DECISIONS #52.
  - [ ] 3.4 Deploy **GitHub Pages** + redirect URL production + test auth/RLS — **workflow đã viết** (`.github/workflows/deploy-dashboard.yml`, commit `8c5d3ad`), build production đã test local OK; **chờ Phong làm mục “3.4 — Phong cần làm” bên dưới** (secrets → Pages → redirect → push `main`) rồi kiểm tra production. Chưa đánh dấu `[x]` vì chưa deploy thật.
- **Phase 4:** bookmark, thảo luận với AI, briefing tuần, gợi ý theo mục tiêu — TASKS.md Phase 4. Làm sau Phase 1–3.

## Dữ liệu & repo hiện tại
- DB: **124 items** — github 19 + hackernews 19 + rss 31 + **facebook 55** (Merlin vẫn bắn thêm). **117/124 có `engagement.score_breakdown`** (7 item FB mới chưa tới kỳ chấm); 95 item `score > 0`, 22 item bị cổng T2 loại (có breakdown toàn 0), 7 item chưa chấm. `score >= 70`: **2** (đều là FB cũ >48h, không notify theo #44); `40–69`: 12.
- `notification_log`: **4 row** — digest thật kỳ 2.0 (score 56 FB prompt, 40 FB Gemini, 40 RSS datasette, 50 RSS llm-echo). Row test instant đã xoá cùng item test.
- `sources`: **6 row đều enabled** — github, hackernews, rss/Simon Willison (`config.url = https://simonwillison.net/atom/everything/`), và **3 group facebook** (`config = { group_id, group_url }`): Vibe Code kiếm cơm `1385451906420187`, Antigravity VN `1522144709086429`, Cộng đồng Claude AI & AI Agents Việt Nam `861108920047086`. Số item: github 19, hn 19, rss 31, fb 13 + 11 + 31. Trang `/nguon` quản lý 3 loại chủ động; **facebook read-only** (DECISIONS #52).
- **`run-cycle` + `ingest-facebook` đã deploy** lên project `gkyneqfagcqgliwtxyfs` (ap-southeast-1) **không dùng flag** — `supabase/config.toml` tối thiểu đã có `[functions.*] verify_jwt = false`:
  - `https://gkyneqfagcqgliwtxyfs.supabase.co/functions/v1/run-cycle`
  - `https://gkyneqfagcqgliwtxyfs.supabase.co/functions/v1/ingest-facebook`
  - Cả 2: `GET` health 200; `POST` thiếu/sai secret → **401 JSON của code** (`{"ok":false,"error":"secret sai hoặc thiếu"}`), chứng minh request vào tới function.
  - `CRON_SECRET` đã có trong `.env` local (không commit) **và** Supabase secrets.
- **`ingest-facebook` = endpoint PUSH** (Merlin POST vào): không checkpoint, chống trùng `UNIQUE(source_id, external_id)`, auth `x-ingest-secret`. Logic `ingest.ts`, entrypoint `index.ts`, hợp đồng ở `ingest-facebook/README.md`. ⚠️ `INGEST_SECRET` trong `.env` local **không khớp** secret production (POST thử 401), nhưng Merlin vẫn bắn được — **không đổi secret production theo `.env`**.
- **Collector API thống nhất:** mỗi collector export `collectSource(supabase, source)` (1 source cụ thể) + `runCollector()` (entrypoint cũ: tự đọc source rồi gọi `collectSource`). `run-cycle` dùng `collectSource` để try/catch từng source.
- **Test có trong repo:** `_shared/xml_test.ts`, `_shared/scoring_test.ts` (11), `_shared/notify_test.ts` (9), `rss-collector/index_test.ts`. Chạy:
  `deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/` → **26 passed (6 steps)**.
  Test nhánh lỗi **ghi thật vào DB** (tạo rồi xoá 6 source `[TEST] ...`), cần `SUPABASE_SERVICE_ROLE_KEY`.
  RSS test đã mock feed Simon bằng fixture `rss-collector/testdata/feed.xml` (30 entry, snapshot 20/10) → **không gọi mạng RSS**, đã chạy 10 lần 10/10 pass.
- **Telegram:** `TELEGRAM_BOT_TOKEN` + `NOTIFY_CHAT_ID=-1004434350401` (group "Bản tin AI") trong `.env` local. ⚠️ Phải là id group (số âm), không phải user id.
- **Dashboard:** `dashboard/` — Next.js **16.4.2** (App Router, TS), **static export** (`output: "export"`, `trailingSlash`, `basePath=/tool-bantin`), chỉ dùng `@supabase/supabase-js` (đã bỏ `@supabase/ssr`). Env local `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `dashboard/.env.local` (gitignored; **không** service_role).
  - Không còn `proxy.ts` / Server Component đọc DB / Route Handler — GitHub Pages không chạy server. `RequireAuth` (client) chặn route private; thêm route private mới thì bọc `RequireAuth`.
  - Auth: `/login` gửi magic link (`emailRedirectTo = origin + BASE_PATH + /auth/callback/`) → `/auth/callback` client đổi `?code=` (PKCE), fallback token trong hash → `/`.
  - RLS: `20261020_dashboard_rls.sql` **đã apply**; policy SELECT `authenticated` cho 3 bảng. Anon thấy 0 row, authenticated thấy dữ liệu. `20261021_sources_write.sql` (3.3) **đã apply**: thêm policy INSERT/UPDATE cho `sources` (authenticated) — xem mục treo.
  - Auth URL: remote `site_url = http://localhost:3000`; redirect `http://localhost:3000/tool-bantin/auth/callback/` **đã được GoTrue chấp nhận** (test 3.1b). Production cần thêm `https://phongnhat43.github.io/tool-bantin/auth/callback/` — xem mục 3.4.
  - User Auth: **`phongnhat43@gmail.com`** (đã confirm); user test mail.tm đã xoá.
  - Chạy: `cd dashboard && npm run dev` → http://localhost:3000/tool-bantin/; `npm run build` sinh `out/`; `npm run lint` pass.
  - Xem bản tĩnh: `ln -sfn "$PWD/dashboard/out" /tmp/bantin-preview/tool-bantin && npx serve -l 3000 /tmp/bantin-preview`.
  - Feed 3 khối + theme + Chạy ngay đã xong (3.2). Trang `/nguon` đã xong (3.3): list 6 nguồn + toggle + form thêm nguồn; facebook read-only. Deploy GitHub Pages: workflow đã viết (3.4, `8c5d3ad`) — **chờ Phong bật Pages/secrets + chạy workflow lần đầu** (mục 3.4 bên dưới).
  - Deploy: `.github/workflows/deploy-dashboard.yml` — push `main` đổi `dashboard/**` hoặc `workflow_dispatch` → Node 20 + `npm ci` + `npm run build` (2 secret public) → `upload-pages-artifact` (`dashboard/out`) → `deploy-pages`, environment `github-pages`.
  - Nguồn: `lib/sources.ts` + `components/sources-manager.tsx`; config form map đúng key collector (`rss` dùng `config.url`). `enabled=false` chỉ dừng **thu thập**, item cũ vẫn được chấm/notify.
  - "Chạy ngay": `rpc("trigger_run_cycle")` (void, pg_net async) rồi poll `rpc("run_cycle_result")` 2s/lần ≤120s. Cần migration `20261021_rpc_grant.sql` (agent đã apply để test; chạy lại vô hại).
- **Git:** `origin/main` = `2535038`; local hơn origin nhiều commit (1.5b, 1.6, 2.1, 2.2, 2.0, 2.1b `1e42c2c`, 2.0b `bfcad05`, 2.3, 3.1, 3.1b `d0b5ab0`, 3.2 `ec8817f` + docs, 3.3 `7c8f888` + docs, 3.4 `8c5d3ad`). Agent không có credential → **nhờ Phong push tay**.
- **Working tree:** sạch sau commit docs 3.4, chỉ còn `supabase/.temp/` untracked (dashboard/.next, dashboard/out, node_modules đã ignore; `.env*` ignored).

## 3.4 — Phong cần làm (deploy production, agent không tự làm được)

- Repo: `https://github.com/PhongNhat43/tool-bantin` (private)
- URL sẽ có: **`https://phongnhat43.github.io/tool-bantin/`**
- Callback chính xác: **`https://phongnhat43.github.io/tool-bantin/auth/callback/`**

### Thứ tự làm (quan trọng)
Không cần push trước khi làm 3 thiết lập — secrets/Pages/redirect là cấu hình trên GitHub/Supabase,
không nằm trong code. Nhưng workflow chỉ xuất hiện trên GitHub **sau khi push**, và GitHub chỉ chạy
workflow ở branch mặc định (`main`).

Thứ tự sạch nhất, tránh fail lần đầu:
**Bước 1 (secrets) → Bước 2 (Pages) → Bước 3 (redirect) → Bước 4 (push) → workflow tự chạy → verify.**

Nếu đã lỡ push trước: cứ làm Bước 1–3 rồi vào Actions **Re-run all jobs** (hoặc **Run workflow**);
không mất gì, chỉ có thể thấy 1 lần job đỏ do Pages chưa bật.

### Bước 1 — Tạo 2 GitHub Actions secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dòng `NEXT_PUBLIC_SUPABASE_URL=` trong `dashboard/.env.local` (dạng `https://gkyneqfagcqgliwtxyfs.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dòng `NEXT_PUBLIC_SUPABASE_ANON_KEY=` trong `dashboard/.env.local` |

- Phải nằm ở tab **Secrets** của **Repository secrets** — không phải tab **Variables**, không phải
  **Environment secrets** (build job không khai báo environment nên environment secrets sẽ không có tác dụng).
- Thêm/sửa secret **sau** một lần chạy thì phải **Re-run all jobs** (hoặc Run workflow) — secret chỉ
  được inject từ lần chạy mới, không tự sửa deployment cũ.

- **KHÔNG** tạo `SUPABASE_SERVICE_ROLE_KEY` (workflow không dùng; service role chỉ ở backend/collector).
- Xem giá trị local: `cd dashboard && grep '^NEXT_PUBLIC_' .env.local` (không commit, không dán vào chat).
- Secret đã lưu thì GitHub không cho đọc lại, chỉ sửa/xoá được.

### Bước 2 — Bật Pages, source = GitHub Actions
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Không chọn “Deploy from a branch”.

⚠️ **Repo đang private**: GitHub Pages cho repo private chỉ có ở gói **Pro/Team/Enterprise**.
Nếu Settings → Pages không cho bật (hoặc workflow báo `Get Pages site failed`), chọn 1 trong 2:
- chuyển repo sang **public** (repo không chứa secret — `.env*` đã ignore; dữ liệu vẫn do Supabase Auth/RLS chặn), hoặc
- nâng gói GitHub. Agent **không tự đổi visibility**.

### Bước 3 — Thêm redirect URL production vào Supabase
Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs → Add URL**:

```
https://phongnhat43.github.io/tool-bantin/auth/callback/
```

Giữ nguyên `http://localhost:3000/tool-bantin/auth/callback/` cho dev.
(Không bắt buộc đổi “Site URL”; app luôn gửi `emailRedirectTo` nên redirect list là đủ. Muốn đổi thì đặt
`https://phongnhat43.github.io/tool-bantin/`.)

### Bước 4 — Push code lên `main` (bắt buộc để workflow tồn tại)
Từ máy local:

```bash
git push origin main
```

- Workflow chỉ có trên GitHub sau khi push; `workflow_dispatch` cũng chỉ xuất hiện sau đó.
- Push này có thay đổi trong `dashboard/**` → workflow **tự chạy** (nếu đã làm Bước 1–3).
- Nếu Actions không tự chạy: tab **Actions** → **Deploy dashboard (GitHub Pages)** → **Run workflow** → `main`.
- Nếu đã push trước khi bật Pages và job `deploy` đỏ: làm Bước 2 rồi **Re-run all jobs**.
- Push bị từ chối (non-fast-forward) thì pull/rebase rồi push lại; **không force push mù**.
- Job `build` → `deploy` xanh; mở `https://phongnhat43.github.io/tool-bantin/`.

### Verify sau khi deploy
- Mở URL khi chưa login → bị đẩy `/tool-bantin/login/`.
- Nhập `phongnhat43@gmail.com` → nhận magic link → callback → thấy Feed thật (3 khối).
- `/tool-bantin/nguon/` bật/tắt được nguồn + thêm nguồn (cần migration `20261021_sources_write.sql` đã chạy).
- DevTools → Sources: bundle chỉ có anon key, **không** có service_role.
- Nếu magic link báo `redirect_uri not allowed` → kiểm tra lại đúng URL ở Bước 3 (có dấu `/` cuối).
- **Nếu trang báo “This page couldn't load”** và console có
  `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` → build lúc deploy thiếu
  `NEXT_PUBLIC_SUPABASE_URL`. Kiểm tra đúng **Repository secrets** (tab Secrets), thêm URL rồi
  **Re-run all jobs**; không cần sửa code. Dấu hiệu nhận biết: bundle có anon key (`eyJ…`) nhưng
  không có chuỗi `*.supabase.co`.

## Quyết định đang treo
- ~~2.3 — Phong chạy SQL~~ **xong**: job `run-cycle-2h` active (`0 */2 * * *`), `net._http_response` trả 200.
- **3.2 — Phong chạy `supabase/migrations/20261021_rpc_grant.sql`** trong SQL Editor (grant `trigger_run_cycle` cho authenticated + revoke anon + hàm đọc `run_cycle_result`). Agent đã apply để test E2E nên nút đã chạy được; chạy lại vô hại.
- **3.3 — Phong chạy `supabase/migrations/20261021_sources_write.sql`** trong SQL Editor (policy INSERT + UPDATE cho `sources` + grant insert/update cho authenticated). Agent đã apply để test E2E (toggle + thêm nguồn chạy thật); chạy lại vô hại.
- **3.1b — Phong làm trên Supabase dashboard:**
  - (a) Authentication → Settings: "Allow new users to sign up" — **đang TẮT sẵn**, giữ nguyên (đã verify: OTP trả `Signups not allowed for otp`).
  - (b) Authentication → URL Configuration → Redirect URLs: thêm `https://phongnhat43.github.io/tool-bantin/auth/callback/` (production) và `http://localhost:3000/tool-bantin/auth/callback/` nếu chưa có. `http://localhost:3000/auth/callback/` (không basePath) chỉ cần nếu chạy bản `NEXT_PUBLIC_BASE_PATH=""`.
  - (c) Thử login thật 1 lần: `npm run dev` → http://localhost:3000/tool-bantin/login/ → nhập `phongnhat43@gmail.com`. Lần test của agent bị **rate limit email của project** (`email rate limit exceeded`) nên phải dùng link do Admin API tạo.
- ~~3.2 — chặn kỹ thuật nút "Chạy ngay"~~ **đã giải** (DECISIONS #50): dashboard gọi `rpc("trigger_run_cycle")`; secret vẫn đọc từ Vault trong function `security definer`, browser không thấy. Cần Phong chạy `supabase/migrations/20261021_rpc_grant.sql` trong SQL Editor (đã apply để test, chạy lại vô hại) — thiếu thì nút báo "chưa có RPC", Feed vẫn chạy.
- **3.4 — GitHub Pages (thay Vercel):** workflow + build production đã xong, **chưa deploy thật**. Phong làm theo mục “3.4 — Phong cần làm” (secrets → Pages source → Supabase redirect URL → push `main` → workflow tự chạy / Run workflow). ⚠️ Repo private: Pages cần gói Pro/Team/Enterprise.
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1.
- **Anthropic news:** không có feed chính thức (DECISIONS #28). Muốn lấy tin Anthropic thì scrape HTML `/news` hoặc dùng nguồn thứ ba — Phong quyết khi nào cần.
- **Push:** local đang hơn `origin/main` khá nhiều commit (2.1b, 2.0b, 2.3, 3.1, 3.1b, 3.2 `ec8817f`, 3.3 `7c8f888` + docs, 3.4 `8c5d3ad`) — Phong push tay. **Push `main` là bước bắt buộc để workflow lên GitHub**; nếu đã làm secrets + bật Pages trước thì push sẽ tự trigger deploy, không cần bấm Run.
- **Contract với Merlin:** payload field chưa có spec cố định — endpoint chấp nhận alias rộng (xem `ingest-facebook/README.md`). Nếu Merlin gửi field lạ chưa map, xin 1 mẫu JSON để bổ sung alias.

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất thay đổi thiết kế — không đề xuất lại thứ đã chốt.
- Mọi ngưỡng/công thức trong AGENTS.md mục 6 là final — không tự ý đổi.
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xoá dòng cũ.
- **Chạy run-cycle local 1 kỳ:**
  `deno run --env-file=.env --allow-net --allow-env --allow-read supabase/functions/run-cycle/index.ts --once`
- **Deploy function (không cần flag — config đã chốt):**
  `supabase functions deploy run-cycle --project-ref gkyneqfagcqgliwtxyfs`
  `supabase functions deploy ingest-facebook --project-ref gkyneqfagcqgliwtxyfs`
  `supabase/config.toml` đã có `verify_jwt = false` cho cả 2.
- **Migration 2.3** (`20261020_run_cycle_cron.sql`) đã chạy; **migration 3.2** (`20261021_rpc_grant.sql`) và **3.3** (`20261021_sources_write.sql`) cần Phong chạy SQL Editor (idempotent, agent đã apply để test). File commit không chứa secret.
- **Dashboard:** `cd dashboard && npm run dev` → http://localhost:3000/tool-bantin/; env ở `dashboard/.env.local` (URL + anon key, không commit). **Static export** (`basePath=/tool-bantin`) — không có server: không tạo `proxy.ts`/`middleware.ts`, không viết Server Component đọc DB, không Route Handler, không `@supabase/ssr` (cookies server). Route private mới phải bọc `RequireAuth`.
- **Supabase CLI:** đã `supabase link --project-ref gkyneqfagcqgliwtxyfs`; có thể chạy SQL bằng `supabase db query --linked "select ..."` hoặc `supabase db query --linked -f <file>.sql` (không cần DB password).
- **Runtime:** Deno 2.9.7. Chạy collector local: `deno run --allow-net --allow-env --allow-read index.ts --once` (cờ đặt SAU tên file).
- **Deno KHÔNG có `DOMParser`/`XMLSerializer`/`Document`** — dùng `_shared/xml.ts` (35 test pass). Xem DECISIONS #23.
- ⚠️ **Đừng viết test import thẳng `index.ts` của collector/run-cycle.** `Deno.serve` bind `127.0.0.1:8000`, health-check của editor gọi vào → handler chạy thêm 1 lượt song song → flaky. Test import `collector.ts`.
- ⚠️ **Cột `items.engagement` là not-null** (`default '{}'`), nhưng PostgREST bulk-upsert điền NULL cho row thiếu key. Mọi upsert theo lô phải luôn gửi `engagement` (object, kể cả `{}`) — bài học #38.
- **Notify:** chỉ tin `published_at` ≤48h; `notify_now` hoặc ≥70 → instant; 40–69 → digest; <40 chỉ lưu DB. Dedup bằng `notification_log`, chỉ log sau khi Telegram `ok:true` (#40/#41/#44).
- ⚠️ Khi test 3.3 bằng link Admin API: session được lưu nhưng callback không tự chuyển trang (đứng ở "Đang xác thực magic link…") — phải mở `/tool-bantin/nguon/` tay. Chưa rõ do dev/tooling hay code callback; **kiểm tra lại luồng magic link thật khi làm 3.4** (3.1b từng test OK).
- **TASKS.md đã từng bị ghi đè mất dấu `[x]`** — Phong sửa trên bản hiện tại (DECISIONS #31). Nếu thấy mất dấu, re-apply cho 0.1–0.4, 1.1, 1.2, 1.4, 1.5, 1.5b, 1.6, 2.0–2.3, 3.1, 3.1b, 3.2, 3.3; **VIỆC TIẾP THEO = hoàn tất 3.4** (Phong làm 4 bước, chạy workflow, test production rồi mới đánh `[x]`).
- Phân vân thì xem DECISIONS #14–#53: #14–#18 collector; #20 orchestrator; #21 scoring; #22 mục 7; #29–#34 test/tách file; #35 ưu tiên 1.6; #36–#38 ingest-facebook; #39 scoring làm tròn; #40–#41 notify; #42–#44 thứ tự Phase 2 + notify lib + giới hạn 48h; #45 config.toml tối thiểu; #46 pg_cron + Vault; #47 dashboard proxy/RLS (đã thay bằng static export); #48 GitHub Pages; #49 callback fallback hash token; #50 nút Chạy ngay qua RPC + poll; #51 revoke EXECUTE của anon trên function `public`; #52 facebook read-only ở trang Nguồn; #53 deploy bằng Pages artifact + 2 secret public + basePath theo tên repo.
