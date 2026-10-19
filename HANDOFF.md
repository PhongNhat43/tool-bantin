# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 19/10/2026 (sau Task 2.2 — notify.ts)_

## Đang ở đâu
- **Phase 0: xong** — Supabase project, schema 3 bảng, git + GitHub, Telegram bot + group nhận tin
- **Phase 1:**
  - [x] 1.1 `_shared/` (types, keywords, normalize) + patch 1.1b (NEGATIVE_EXCEPTIONS)
  - [x] 1.2 github-collector + patch 1.2b (GITHUB_TOKEN, move schema.sql)
  - [x] 1.4 hackernews-collector
  - [x] 1.5 rss-collector + `_shared/xml.ts` (parser tự viết — Deno không có DOMParser) — commit `e0510af`
  - [x] 1.5b tách `github-collector` + `hackernews-collector` thành `collector.ts` (logic) + `index.ts` (entrypoint) — đóng cảnh báo #33 — commit `da64117` + `241dd4f`
  - [x] 1.6 ingest-facebook — endpoint POST nhận JSON từ Merlin (3 group FB đã seed; auth `x-ingest-secret`) — commit `dba3082` — **Merlin đã bắn dữ liệu thật (24 item FB trong DB)**
  - [ ] 1.3 reddit-collector — DỜI CUỐI Phase 1 (chờ quyết định phê duyệt API Reddit)
- **Phase 2:** final plan đã chốt 19/10 — chi tiết scoring đầy đủ + orchestrator `run-cycle` nằm ở **AGENTS.md mục 6** (phần "Chi tiết scoring"); việc chia nhỏ ở TASKS.md 2.0–2.3.
  - [x] 2.1 `_shared/scoring.ts` — lib thuần túy (không DB/mạng): cổng T2, topic 0–40, engagement nội suy 0–30, recency 6/12/24/48h 0–20, cross-source 0–10, 3 luật `notify_now` a/b/c + `notify_reason`. Commit `79485ce`; **11 test offline** trong `_shared/scoring_test.ts`.
  - [x] 2.2 `_shared/notify.ts` — `sendInstant` (≥70/trigger, preview bật) + `sendDigest` (40–69, 1 tin/lô, preview tắt); chống trùng `notification_log`; chỉ log khi Telegram `ok:true`; escape HTML, cắt tiêu đề 150, digest >4096 → `…và N tin khác`. Commit `5e3e9de`; **9 test offline** trong `_shared/notify_test.ts`; **đã gửi thật** vào group "Bản tin AI" (bot @tool_batin_ai_bot) → `sent`, gọi lại `skipped`, xoá log test. Xem DECISIONS #40/#41.
  - [ ] 2.0 `run-cycle` — **TASK TIẾP THEO** (1.6 xong, Merlin **đã bắn dữ liệu FB thật**). Khi làm: import `scoreItem` từ `_shared/scoring.ts` + `sendInstant`/`sendDigest` từ `_shared/notify.ts`; tự truy DB tìm tin trùng 24h rồi truyền `cross_source`; ghi `score` + `breakdown` vào `engagement.score_breakdown`; tin `notify_now` hoặc ≥70 → `sendInstant`, 40–69 → `sendDigest`.
  - [ ] 2.3 pg_cron + pg_net.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo đã có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).
- **Phase 4 (mới, Phong thêm 19/10):** bookmark, thảo luận với AI, briefing tuần, gợi ý theo mục tiêu — TASKS.md Phase 4. Ý tưởng, làm sau Phase 1–3.

## Dữ liệu & repo hiện tại
- DB: **88 items** (github 19 + hackernews 15 + rss 30 + **facebook 24** — Merlin đã bắn dữ liệu FB thật), mọi `score = 0` (chấm điểm theo lịch là việc `run-cycle` Task 2.0 — lib `scoring.ts` đã sẵn). `notification_log` **0 row** (row test của 2.2 đã xoá). HN từ 14 → 15 vì khi chụp baseline 1.5b có xoá `last_seen` nên quét rộng 7 ngày, nhặt thêm 1 story thật.
- `sources`: **6 row đều enabled** — github, hackernews, rss/Simon Willison (`config.url = https://simonwillison.net/atom/everything/`), và **3 group facebook** (`type='facebook'`, `config = { group_id, group_url }`): Vibe Code kiếm cơm `1385451906420187`, Antigravity VN `1522144709086429`, Cộng đồng Claude AI & AI Agents Việt Nam `861108920047086`.
- **`ingest-facebook` = endpoint PUSH** (Merlin POST vào), KHÁC các collector khác: không có checkpoint, chống trùng bằng `UNIQUE(source_id, external_id)`, xác thực bằng header `x-ingest-secret` (env `INGEST_SECRET`). Logic ở `ingest.ts` (không phải `collector.ts`), entrypoint `index.ts`. Hợp đồng dữ liệu cho Merlin: `supabase/functions/ingest-facebook/README.md` (aliases + curl + mã lỗi). ⚠️ Phải tắt `verify_jwt` cho riêng function (`supabase/config.toml` đã khai) — nếu không Supabase chặn 401 trước khi code chạy.
- **Test có trong repo** (từ 19/10, DECISIONS #30): `_shared/xml_test.ts` + `_shared/scoring_test.ts` (11 test offline) + `_shared/notify_test.ts` (9 test offline, cần `--allow-env`) + `rss-collector/index_test.ts`. Chạy: `deno test --allow-net --allow-env --allow-read supabase/functions/` → **26 passed (6 steps)**, 0 failed. Test nhánh lỗi **ghi thật vào DB** (tạo rồi xoá 6 source `[TEST] ...`), cần `SUPABASE_SERVICE_ROLE_KEY`; chạy kèm `--env-file=.env`.
- **Telegram notify (2.2):** `TELEGRAM_BOT_TOKEN` + `NOTIFY_CHAT_ID` nay đã có trong `.env` local (không commit). ⚠️ `NOTIFY_CHAT_ID` **phải là id group** (`-1004434350401` = group "Bản tin AI"), KHÔNG phải user id — user id sẽ báo `Forbidden: bot can't initiate conversation with a user`.
- **Mọi collector tách 2 file** (DECISIONS #32 + #34): `<name>/collector.ts` = toàn bộ logic (import KHÔNG có tác dụng phụ, export `runCollector`), `<name>/index.ts` = entrypoint ~30 dòng (`--once` → chạy 1 lần, ngược lại → `Deno.serve`). Đã áp dụng cho **cả 3**: rss, github, hackernews. `ingest-facebook` cũng tách y vậy nhưng tên file logic là `ingest.ts` (nó là endpoint push, không phải collector fetch). Test import file logic, KHÔNG import `index.ts`.
- GitHub: `origin/main` = `2535038` (7 commit của 1.5 + fix flaky **đã được Phong push**); còn **5 commit local chưa push**: `da64117` + `241dd4f` (code 1.5b), docs 1.5b, `dba3082` (code 1.6), và commit docs 1.6 (HEAD). Working tree sạch.

## Quyết định đang treo
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay tuần này, chờ 2–4 tuần) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1
- **Anthropic news:** không có feed chính thức (DECISIONS #28). Muốn lấy tin Anthropic thì phải scrape HTML `/news` hoặc dùng nguồn thứ ba — Phong quyết khi nào cần.
- **Push:** `origin/main` = `2535038`; local đang hơn origin khá nhiều commit (1.5b, 1.6, 2.1, 2.2 + docs) — agent không có credential nên phải nhờ Phong push tay.
- **Deploy + secret cho 1.6:** Phong cần (a) tạo `INGEST_SECRET` trên Supabase (`supabase secrets set INGEST_SECRET=<64 hex>` hoặc dashboard → Edge Functions → Secrets) và (b) deploy `ingest-facebook` với **verify_jwt = false** (xem `supabase/config.toml`). Sau đó Merlin bắn dữ liệu thật. Secret local đã có sẵn trong `.env`; tạo mới bằng `openssl rand -hex 32`.
- **Contract với Merlin:** payload field chưa có spec cố định — endpoint hiện chấp nhận alias rộng (xem `ingest-facebook/README.md`). Nếu Merlin gửi field lạ chưa map, gửi 1 mẫu JSON để bổ sung alias.

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất bất kỳ thay đổi thiết kế nào — không đề xuất lại thứ đã chốt
- Mọi ngưỡng và công thức trong AGENTS.md mục 6 là final — không tự ý đổi
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xóa dòng cũ
- **Runtime:** Deno 2.9.7 đã cài qua brew. Chạy 1 collector local bằng
  `deno run --allow-net --allow-env --allow-read index.ts --once` (thêm `--once`, nếu không nó sẽ chạy `Deno.serve` và treo). Cờ phải đặt SAU tên file.
- **Deno KHÔNG có `DOMParser`/`XMLSerializer`/`Document`** (không phải API của Deno, không có kể cả với `--unstable*`) — đừng thử lại. Cần parse XML/RSS thì dùng `supabase/functions/_shared/xml.ts` (đã có sẵn, 35 test pass). Xem DECISIONS #23.
- ⚠️ **Đừng viết test import thẳng `index.ts` của collector.** `Deno.serve` bind `127.0.0.1:8000`, và health-check của editor gọi `GET /health` vào đó → handler chạy thêm 1 lượt collector **song song** với lượt của test → test flaky kiểu "số lần gọi mạng nhân đôi". ✅ **Đã tách xong cả 3 collector** (rss #32; github + hackernews #34/1.5b) → logic nằm ở `collector.ts`, viết test import file đó (`./collector.ts`), KHÔNG import `./index.ts`.
- **Push GitHub:** repo **private**. Shell của agent **không có credential** nên không tự push được — phải nhờ Phong push tay.
- ✅ **AGENTS.md đã có mục 7** (quy trình làm việc & bàn giao) — bắt buộc tuân thủ: 1 task = 1 commit, append WORKLOG/DECISIONS, cập nhật HANDOFF, push khi được yêu cầu.
- ✅ **Thứ tự mục AGENTS.md đã đúng:** 1 → 7 liên tục (mục 7 đã chuyển xuống cuối, sau mục 6).
- ⚠️ **TASKS.md đã từng bị ghi đè mất dấu `[x]` 2 lần** (19/10). Từ giờ Phong sửa TRÊN bản hiện tại, không copy từ bản cũ (DECISIONS #31) → model không phải re-apply nữa. Nếu vẫn thấy mất dấu thì re-apply cho 0.1–0.4, 1.1, 1.2, 1.4, 1.5, 1.5b, 1.6 + ghi chú (1.3 DỜI cuối Phase 1 + chờ API Reddit, 1.7 ĐỂ V2; **TASK TIẾP THEO = 2.0 run-cycle**).
- Phân vân thì xem `DECISIONS.md` #14–#38: #14–#18, #23–#28 là quyết định kỹ thuật collector; #20 gỡ vênh orchestrator; #21 chốt chi tiết scoring; #22 mục 7 có hiệu lực; #29 tổng kết Task 1.5; #30 test vào repo; #31 cách sửa TASKS.md; #32 tách `collector.ts` vì bẫy cổng 8000; #33 cảnh báo 2 collector còn lại; #34 đã tách nốt 2 collector đó (1.5b); #35 ưu tiên 1.6 trước test github/HN; #36–#37 hợp đồng ingest-facebook (push, không checkpoint, alias rộng, auth secret, tắt verify_jwt); #38 bug `engagement` not-null khi bulk-upsert.
- ⚠️ **Cột `items.engagement` là not-null** (`default '{}'`), nhưng PostgREST **bulk-upsert điền NULL cho row thiếu key** (KHÔNG dùng default). Với mọi collector upsert theo lô: field not-null phải **luôn có mặt trong mọi phần tử**. Đã dính đúng lỗi này ở 1.6 (DECISIONS #38).
