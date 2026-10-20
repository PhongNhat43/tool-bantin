# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 20/10/2026 (sau Task 2.0 — run-cycle)_

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
  - [ ] 2.3 pg_cron + pg_net — **TASK TIẾP THEO**.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).
- **Phase 4:** bookmark, thảo luận với AI, briefing tuần, gợi ý theo mục tiêu — TASKS.md Phase 4. Làm sau Phase 1–3.

## Dữ liệu & repo hiện tại
- DB: **117 items** — github 19 + hackernews 19 + rss 31 + **facebook 48**. **117/117 có `engagement.score_breakdown`**; 95 item `score > 0`, 22 item bị cổng T2 loại (`score=0` nhưng có breakdown để không chấm lại). `score >= 70`: **2** (đều là FB cũ >48h, không notify theo #44); `40–69`: 12.
- `notification_log`: **4 row** — digest thật kỳ 2.0 (score 56 FB prompt, 40 FB Gemini, 40 RSS datasette, 50 RSS llm-echo). Row test instant đã xoá cùng item test.
- `sources`: **6 row đều enabled** — github, hackernews, rss/Simon Willison (`config.url = https://simonwillison.net/atom/everything/`), và **3 group facebook** (`config = { group_id, group_url }`): Vibe Code kiếm cơm `1385451906420187`, Antigravity VN `1522144709086429`, Cộng đồng Claude AI & AI Agents Việt Nam `861108920047086`.
- **`run-cycle` đã deploy** lên project `gkyneqfagcqgliwtxyfs` (ap-southeast-1) với `--no-verify-jwt`:
  `https://gkyneqfagcqgliwtxyfs.supabase.co/functions/v1/run-cycle`
  - `GET` → 200 health; `POST` thiếu/sai `x-cron-secret` → 401; đúng → 200 summary.
  - `CRON_SECRET` đã có trong `.env` local (không commit) **và** Supabase secrets.
- **`ingest-facebook` = endpoint PUSH** (Merlin POST vào): không checkpoint, chống trùng `UNIQUE(source_id, external_id)`, auth `x-ingest-secret`. Logic `ingest.ts`, entrypoint `index.ts`, hợp đồng ở `ingest-facebook/README.md`. ⚠️ `INGEST_SECRET` trong `.env` local **không khớp** secret production (POST thử 401), nhưng Merlin vẫn bắn được — **không đổi secret production theo `.env`**.
- **Collector API thống nhất:** mỗi collector export `collectSource(supabase, source)` (1 source cụ thể) + `runCollector()` (entrypoint cũ: tự đọc source rồi gọi `collectSource`). `run-cycle` dùng `collectSource` để try/catch từng source.
- **Test có trong repo:** `_shared/xml_test.ts`, `_shared/scoring_test.ts` (11), `_shared/notify_test.ts` (9), `rss-collector/index_test.ts`. Chạy:
  `deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/` → **26 passed (6 steps)**.
  Test nhánh lỗi **ghi thật vào DB** (tạo rồi xoá 6 source `[TEST] ...`), cần `SUPABASE_SERVICE_ROLE_KEY`.
  ⚠️ Test "source thật không bị đụng tới" của RSS **flaky khi feed Simon có bài mới**: checkpoint tiến → fail lần đầu, chạy lại pass. Chưa sửa (ngoài scope 2.0).
- **Telegram:** `TELEGRAM_BOT_TOKEN` + `NOTIFY_CHAT_ID=-1004434350401` (group "Bản tin AI") trong `.env` local. ⚠️ Phải là id group (số âm), không phải user id.
- **Git:** `origin/main` = `2535038`; local hơn origin nhiều commit (1.5b, 1.6, 2.1, 2.2, 2.0 + docs). Agent không có credential → **nhờ Phong push tay**.
- **Working tree:** `supabase/config.toml` đang bị xoá (thay đổi có sẵn từ trước, agent KHÔNG đụng); `supabase/config.toml.bak` + `supabase/.temp/` untracked. Deploy 2.0 dùng cờ `--no-verify-jwt` thay vì file config.

## Quyết định đang treo
- **2.3 pg_cron:** bật `pg_cron` + `pg_net`, tạo job mỗi 2h gọi `POST /functions/v1/run-cycle` với header `x-cron-secret` = `CRON_SECRET`. Cần quyết định lưu secret trong Vault hay `ALTER DATABASE SET` (không hardcode trong migration).
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1.
- **Anthropic news:** không có feed chính thức (DECISIONS #28). Muốn lấy tin Anthropic thì scrape HTML `/news` hoặc dùng nguồn thứ ba — Phong quyết khi nào cần.
- **Push:** local đang hơn `origin/main` khá nhiều commit — Phong push tay.
- **Contract với Merlin:** payload field chưa có spec cố định — endpoint chấp nhận alias rộng (xem `ingest-facebook/README.md`). Nếu Merlin gửi field lạ chưa map, xin 1 mẫu JSON để bổ sung alias.
- **`supabase/config.toml`:** bản HEAD dùng comment `//` (không phải TOML hợp lệ) và đang bị xoá ở working tree. Nếu sau này deploy không kèm `--no-verify-jwt`, cần sửa/tạo config đúng cú pháp với `[functions.run-cycle] verify_jwt = false` + `[functions.ingest-facebook] verify_jwt = false`.

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất thay đổi thiết kế — không đề xuất lại thứ đã chốt.
- Mọi ngưỡng/công thức trong AGENTS.md mục 6 là final — không tự ý đổi.
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xoá dòng cũ.
- **Chạy run-cycle local 1 kỳ:**
  `deno run --env-file=.env --allow-net --allow-env --allow-read supabase/functions/run-cycle/index.ts --once`
- **Deploy run-cycle:**
  `supabase functions deploy run-cycle --project-ref gkyneqfagcqgliwtxyfs --no-verify-jwt`
- **Runtime:** Deno 2.9.7. Chạy collector local: `deno run --allow-net --allow-env --allow-read index.ts --once` (cờ đặt SAU tên file).
- **Deno KHÔNG có `DOMParser`/`XMLSerializer`/`Document`** — dùng `_shared/xml.ts` (35 test pass). Xem DECISIONS #23.
- ⚠️ **Đừng viết test import thẳng `index.ts` của collector/run-cycle.** `Deno.serve` bind `127.0.0.1:8000`, health-check của editor gọi vào → handler chạy thêm 1 lượt song song → flaky. Test import `collector.ts`.
- ⚠️ **Cột `items.engagement` là not-null** (`default '{}'`), nhưng PostgREST bulk-upsert điền NULL cho row thiếu key. Mọi upsert theo lô phải luôn gửi `engagement` (object, kể cả `{}`) — bài học #38.
- **Notify:** chỉ tin `published_at` ≤48h; `notify_now` hoặc ≥70 → instant; 40–69 → digest; <40 chỉ lưu DB. Dedup bằng `notification_log`, chỉ log sau khi Telegram `ok:true` (#40/#41/#44).
- **TASKS.md đã từng bị ghi đè mất dấu `[x]`** — Phong sửa trên bản hiện tại (DECISIONS #31). Nếu thấy mất dấu, re-apply cho 0.1–0.4, 1.1, 1.2, 1.4, 1.5, 1.5b, 1.6, 2.0–2.2; **TASK TIẾP THEO = 2.3**.
- Phân vân thì xem DECISIONS #14–#44: #14–#18 collector; #20 orchestrator; #21 scoring; #22 mục 7; #29–#34 test/tách file; #35 ưu tiên 1.6; #36–#38 ingest-facebook; #39 scoring làm tròn; #40–#41 notify; #42–#44 thứ tự Phase 2 + notify lib + giới hạn 48h.
