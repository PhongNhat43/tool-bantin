# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 20/10/2026 (sau Task 3.1b — dashboard chuyển sang static export GitHub Pages)_

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
  - [x] 2.3 pg_cron + pg_net + Vault — migration `20261020_run_cycle_cron.sql`, wrapper `public.trigger_run_cycle()`, job `run-cycle-2h` lịch `0 */2 * * *`; secret Vault placeholder `__CRON_SECRET__`. **Chưa chạy SQL — chờ Phong chạy SQL Editor + verify.** Xem DECISIONS #46.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).
  - [x] 3.1 Scaffold Next.js 16 trong `dashboard/`: App Router, TypeScript, không src-dir; magic link; RLS SELECT `authenticated`; trang chủ tạm 10 item mới nhất. Đã test E2E thật (mail.tm). Xem DECISIONS #47. **Phần server (`proxy.ts`, `@supabase/ssr`, Server Component, Route Handler) đã bị 3.1b gỡ bỏ.**
  - [x] 3.1b **Chuyển dashboard sang static export cho GitHub Pages** (thay Vercel): `output: "export"` + `trailingSlash` + `basePath=/tool-bantin`; `RequireAuth` (client) chặn route private; `/login` + `/auth/callback` client (PKCE, fallback hash token); trang chủ fetch client; bỏ `@supabase/ssr`. Build ra `out/`, đã test serve tĩnh + login + logout. Commit `d0b5ab0`. Xem DECISIONS #48/#49.
  - [ ] 3.2 Trang Feed đúng demo (3 khối, Feedly, expand breakdown, dark toggle, nút Chạy ngay) — **TASK TIẾP THEO**, nhưng phải làm **client-side** (static export: không Server Component đọc DB, không searchParams server, không Route Handler). Nút "Chạy ngay" phải gọi thẳng edge function `run-cycle` từ browser bằng `x-cron-secret`… **KHÔNG được** nhúng secret vào client → cần chốt cách (xem "Quyết định đang treo").
  - [ ] 3.3 Trang Nguồn (list + toggle + form thêm nguồn).
  - [ ] 3.4 Deploy **GitHub Pages** (thay Vercel) + redirect URL production + test auth/RLS — chờ Phong chốt lại nội dung.
- **Phase 4:** bookmark, thảo luận với AI, briefing tuần, gợi ý theo mục tiêu — TASKS.md Phase 4. Làm sau Phase 1–3.

## Dữ liệu & repo hiện tại
- DB: **117 items** — github 19 + hackernews 19 + rss 31 + **facebook 48**. **117/117 có `engagement.score_breakdown`**; 95 item `score > 0`, 22 item bị cổng T2 loại (`score=0` nhưng có breakdown để không chấm lại). `score >= 70`: **2** (đều là FB cũ >48h, không notify theo #44); `40–69`: 12.
- `notification_log`: **4 row** — digest thật kỳ 2.0 (score 56 FB prompt, 40 FB Gemini, 40 RSS datasette, 50 RSS llm-echo). Row test instant đã xoá cùng item test.
- `sources`: **6 row đều enabled** — github, hackernews, rss/Simon Willison (`config.url = https://simonwillison.net/atom/everything/`), và **3 group facebook** (`config = { group_id, group_url }`): Vibe Code kiếm cơm `1385451906420187`, Antigravity VN `1522144709086429`, Cộng đồng Claude AI & AI Agents Việt Nam `861108920047086`.
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
  - RLS: `20261020_dashboard_rls.sql` **đã apply**; policy SELECT `authenticated` cho 3 bảng. Anon thấy 0 row, authenticated thấy dữ liệu.
  - Auth URL: remote `site_url = http://localhost:3000`; redirect `http://localhost:3000/tool-bantin/auth/callback/` **đã được GoTrue chấp nhận** (test 3.1b). Còn thiếu URL GitHub Pages.
  - User Auth: **`phongnhat43@gmail.com`** (đã confirm); user test mail.tm đã xoá.
  - Chạy: `cd dashboard && npm run dev` → http://localhost:3000/tool-bantin/; `npm run build` sinh `out/`; `npm run lint` pass.
  - Xem bản tĩnh: `ln -sfn "$PWD/dashboard/out" /tmp/bantin-preview/tool-bantin && npx serve -l 3000 /tmp/bantin-preview`.
  - Trang chủ hiện là list thô 10 item; UI Feedly để 3.2 (client-side). Chưa deploy (3.4 → GitHub Pages).
- **Git:** `origin/main` = `2535038`; local hơn origin nhiều commit (1.5b, 1.6, 2.1, 2.2, 2.0, 2.1b `1e42c2c`, 2.0b `bfcad05`, 2.3, 3.1, 3.1b `d0b5ab0` + docs). Agent không có credential → **nhờ Phong push tay**.
- **Working tree:** sau commit 3.1b chỉ còn `supabase/.temp/` untracked (dashboard/.next, dashboard/out, node_modules đã ignore). `supabase/config.toml` đã chốt + commit; `config.toml.bak` đã xoá.

## Quyết định đang treo
- **2.3 — Phong chạy SQL:** mở SQL Editor, chạy 4 khối trong `supabase/migrations/20261020_run_cycle_cron.sql`; thay `__CRON_SECRET__` bằng giá trị trong `.env` local. `CRON_SECRET` đã set sẵn trên Supabase secrets (không cần tạo mới). Verify `cron.job` có `run-cycle-2h`, gọi tay `select public.trigger_run_cycle()`, check `cron.job_run_details` + `net._http_response` (status 200). Nếu `create extension` báo thiếu quyền/không có → báo lại.
- **3.1b — Phong làm trên Supabase dashboard:**
  - (a) Authentication → Settings: "Allow new users to sign up" — **đang TẮT sẵn**, giữ nguyên (đã verify: OTP trả `Signups not allowed for otp`).
  - (b) Authentication → URL Configuration → Redirect URLs: thêm `https://phongnhat43.github.io/tool-bantin/auth/callback/` (production) và `http://localhost:3000/tool-bantin/auth/callback/` nếu chưa có. `http://localhost:3000/auth/callback/` (không basePath) chỉ cần nếu chạy bản `NEXT_PUBLIC_BASE_PATH=""`.
  - (c) Thử login thật 1 lần: `npm run dev` → http://localhost:3000/tool-bantin/login/ → nhập `phongnhat43@gmail.com`. Lần test của agent bị **rate limit email của project** (`email rate limit exceeded`) nên phải dùng link do Admin API tạo.
- **3.2 — chặn kỹ thuật cần chốt trước khi code:** nút "Chạy ngay" gọi `run-cycle`. Bản cũ dùng Route Handler giữ `CRON_SECRET` ở server, nhưng static export **không có server** → không được nhúng secret vào bundle client (ai cũng đọc được). Đề xuất: thêm nhánh auth cho `run-cycle` nhận **JWT của user dashboard** (`supabase.auth.getUser(token)`) thay vì chỉ `x-cron-secret`; dashboard gọi bằng access token của session. Phương án khác: GitHub Actions `workflow_dispatch` + secret trong Actions. Chờ Phong chọn.
- **3.4 — GitHub Pages (thay Vercel):** cần bật Pages cho repo (source GitHub Actions hoặc branch `gh-pages` chứa `out/`), thêm redirect URL production vào Supabase Auth; env production chỉ URL + anon key (không secret).
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1.
- **Anthropic news:** không có feed chính thức (DECISIONS #28). Muốn lấy tin Anthropic thì scrape HTML `/news` hoặc dùng nguồn thứ ba — Phong quyết khi nào cần.
- **Push:** local đang hơn `origin/main` khá nhiều commit (thêm 2.1b, 2.0b, 2.3, 3.1) — Phong push tay.
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
- **Migration 2.3:** `supabase/migrations/20261020_run_cycle_cron.sql` — chưa chạy; Phong chạy SQL Editor. Placeholder `__CRON_SECRET__` phải thay bằng giá trị thật trước khi chạy; file commit không chứa secret.
- **Dashboard:** `cd dashboard && npm run dev` → http://localhost:3000/tool-bantin/; env ở `dashboard/.env.local` (URL + anon key, không commit). **Static export** (`basePath=/tool-bantin`) — không có server: không tạo `proxy.ts`/`middleware.ts`, không viết Server Component đọc DB, không Route Handler, không `@supabase/ssr` (cookies server). Route private mới phải bọc `RequireAuth`.
- **Supabase CLI:** đã `supabase link --project-ref gkyneqfagcqgliwtxyfs`; có thể chạy SQL bằng `supabase db query --linked "select ..."` hoặc `supabase db query --linked -f <file>.sql` (không cần DB password).
- **Runtime:** Deno 2.9.7. Chạy collector local: `deno run --allow-net --allow-env --allow-read index.ts --once` (cờ đặt SAU tên file).
- **Deno KHÔNG có `DOMParser`/`XMLSerializer`/`Document`** — dùng `_shared/xml.ts` (35 test pass). Xem DECISIONS #23.
- ⚠️ **Đừng viết test import thẳng `index.ts` của collector/run-cycle.** `Deno.serve` bind `127.0.0.1:8000`, health-check của editor gọi vào → handler chạy thêm 1 lượt song song → flaky. Test import `collector.ts`.
- ⚠️ **Cột `items.engagement` là not-null** (`default '{}'`), nhưng PostgREST bulk-upsert điền NULL cho row thiếu key. Mọi upsert theo lô phải luôn gửi `engagement` (object, kể cả `{}`) — bài học #38.
- **Notify:** chỉ tin `published_at` ≤48h; `notify_now` hoặc ≥70 → instant; 40–69 → digest; <40 chỉ lưu DB. Dedup bằng `notification_log`, chỉ log sau khi Telegram `ok:true` (#40/#41/#44).
- **TASKS.md đã từng bị ghi đè mất dấu `[x]`** — Phong sửa trên bản hiện tại (DECISIONS #31). Nếu thấy mất dấu, re-apply cho 0.1–0.4, 1.1, 1.2, 1.4, 1.5, 1.5b, 1.6, 2.0–2.3, 3.1, 3.1b; **VIỆC TIẾP THEO = 3.2 (Feed UI)**, sau đó 3.3 → 3.4; 2.3 vẫn chờ Phong chạy SQL.
- Phân vân thì xem DECISIONS #14–#49: #14–#18 collector; #20 orchestrator; #21 scoring; #22 mục 7; #29–#34 test/tách file; #35 ưu tiên 1.6; #36–#38 ingest-facebook; #39 scoring làm tròn; #40–#41 notify; #42–#44 thứ tự Phase 2 + notify lib + giới hạn 48h; #45 config.toml tối thiểu; #46 pg_cron + Vault; #47 dashboard proxy/RLS (đã thay bằng static export); #48 GitHub Pages; #49 callback fallback hash token.
