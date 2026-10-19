# WORKLOG — nhật ký công việc theo session

> Append-only: mỗi task xong thêm 1 mục mới ở cuối, KHÔNG sửa mục cũ.
> Format: ## YYYY-MM-DD — Task X: tên task → việc làm → kết quả test → commit (nếu có)

## 2026-10-19 — Task 0.2: chạy schema.sql
- Chạy trong Supabase SQL Editor. Tạo 3 bảng: sources, items (UNIQUE source_id + external_id), notification_log. OK.

## 2026-10-19 — Task 0.3: git + GitHub
- Tạo .gitignore (chặn .env, có ngoại lệ `!.env.example`), .env.example (mẫu không giá trị thật), commit scaffold `74a018b` rồi push GitHub. Lưu ý: thư mục đã có `.git` sẵn nên **KHÔNG chạy `git init`**. Repo là **private**: `PhongNhat43/tool-bantin`.

## 2026-10-19 — Task 0.4: Telegram bot
- @BotFather tạo bot → tạo group "Bản tin AI" → add bot làm admin → lấy chat_id qua getUpdates → lưu TELEGRAM_BOT_TOKEN + NOTIFY_CHAT_ID vào Supabase secrets. Test sendMessage OK.

## 2026-10-19 — Task 1.1: _shared (types/keywords/normalize)
- 3 file trong supabase/functions/_shared/: types.ts (ItemInput, KeywordGroups), keywords.ts (KEYWORDS 4 nhóm + negative, matchKeywords), normalize.ts (normalize, normalizeUrl, normalizePublishedAt). Test: normalize 4 ca (đủ field / thiếu title / có utm_* / thiếu cả 4) + matchKeywords 9 ca (A, B, C, D, không khớp, bán hàng có dấu & không dấu) + 5 ca trừ điểm, pass.

## 2026-10-19 — Patch 1.1b: NEGATIVE_EXCEPTIONS
- Thêm ["không bán", "đánh giá"]; maskExceptions() khoét cụm exception (2 bản có dấu/không dấu) trước khi so negative. Test 3 ca bắt buộc + 12 ca hồi quy, pass.

## 2026-10-19 — Task 1.2: github-collector
- supabase/functions/github-collector/index.ts. Chạy thật 2 lần: 19 repo mới → 0 mới (UNIQUE chặn trùng). Error-handling test bằng mock fetch: 403 + `x-ratelimit-remaining: 0` → dừng êm, chỉ 1 call không retry; lỗi mạng → retry 3 lần backoff 500/1000/2000ms rồi throw; 500 hai lần rồi 200 → tự phục hồi. Commit 6253a0c.

## 2026-10-19 — Patch 1.2b: dọn dẹp
- Verify GITHUB_TOKEN qua đọc code (có token → gửi Authorization header). Thêm GITHUB_TOKEN vào .env.example. Move schema.sql → supabase/migrations/. Commit "feat: github-collector + shared libs". Chưa push (đã push sau).

## 2026-10-19 — Task 1.4: hackernews-collector
- supabase/functions/hackernews-collector/index.ts. Seed 2 queries ("Claude Code", "AI coding"). Chạy 2 lần: 18 thô → 14 unique (gộp Map theo objectID) → 14 mới → 0 mới. 429: dừng êm, KHÔNG ghi checkpoint. URL fallback về news.ycombinator.com/item khi story không có link ngoài. Commit b63e13a. Đã push GitHub (main sạch).

## 2026-10-19 — Backfill: môi trường & hạ tầng (bổ sung khi áp dụng cơ chế bàn giao)
- **Deno 2.9.7** cài qua `brew install deno` — runtime bắt buộc của Supabase Edge Functions. Chạy collector local bằng:
  `deno run --allow-net --allow-env --allow-read index.ts --once` (cờ `--once` do collector tự định nghĩa; không có `--once` thì nó chạy `Deno.serve` để làm HTTP endpoint).
- **Xác thực GitHub:** repo là **private**. Shell của agent **không có credential** (HTTPS đòi username/token, SSH key `SHA256:MclSs…hWTtI` chưa add vào account `PhongNhat43`) → agent không tự `git push` được, phải nhờ Phong push tay. Trạng thái hiện tại: `origin/main` = `b63e13a`, 0 commit chưa push.
- **Task 0.1 chưa từng có mục riêng trong WORKLOG** (làm trực tiếp trên Supabase dashboard) — đã bổ sung dấu [x] trong TASKS.md.
- **Số liệu verify 19/10:** DB có 33 items (github 19 + hackernews 14), mọi `score` = 0; bảng `sources` có 2 row (github, hackernews) đều `enabled=true`.
- **Kiểm tra nhánh lỗi** của cả 2 collector được làm bằng mock `globalThis.fetch` (offline, tất định) — xem DECISIONS #17.

## 2026-10-19 — Ban hành AGENTS.md mục 7 + đồng bộ docs (chưa phải task trong TASKS.md)
- Phát hiện lúc đầu: AGENTS.md **chưa có mục 7** (chỉ 6 mục, md5 bản trên đĩa khớp bản trong git) → đã báo lại thay vì tự bịa luật. Phong bổ sung mục 7 sau đó.
- **TASKS.md bị ghi đè** khi Phong cập nhật (mất hết dấu `[x]` đã backfill) → re-apply dấu `[x]` + ngày + commit hash cho 0.1–0.4, 1.1, 1.2, 1.4 theo đúng format mục 7.4.
- Append DECISIONS #20 (gỡ vênh #7 vs TASKS 2.3: run-cycle là orchestrator, pg_cron gọi qua pg_net), #21 (chốt chi tiết scoring), #22 (mục 7 có hiệu lực).
- Cập nhật HANDOFF: bỏ cảnh báo "chưa có mục 7", ghi nhận 2 blind spot mới (xem dưới), cập nhật trạng thái push.
- **Blind spot đã báo, KHÔNG tự sửa:**
  1. Thứ tự mục AGENTS.md sai — mục 7 nằm TRƯỚC mục 6 (dòng 33 vs 46).
  2. `dashboard-demo.html` được tham chiếu ở AGENTS.md §5, TASKS.md Phase 3, HANDOFF.md nhưng **không có file trong repo**.
- Kết quả test: không có code mới; verify bằng `find`/`grep`/`md5`/`git diff` (log ở phần bàn giao).
- Commit: `docs: ban hành AGENTS.md mục 7 + đồng bộ docs` (chính là commit chứa mục WORKLOG này).

## 2026-10-19 — Xử lý 2 blind spot của mục 7 (Phong duyệt)
- **Blind spot #1 — thứ tự mục AGENTS.md (đã sửa):** mục 7 nằm TRƯỚC mục 6 → chuyển **nguyên khối** mục 7 xuống cuối, không đổi một chữ nào. Verify: 58 dòng trước = 58 dòng sau, `diff <(sort trước) <(sort sau)` rỗng → thuần đổi thứ tự. Thứ tự nay: 1→7 liên tục.
- **Blind spot #2 — `dashboard-demo.html` (đã có):** Phong tự bổ sung file vào repo (404 dòng, 20 KB, `data-theme="light"` + toggle dark). Đã kiểm tra **không chứa secret** (không có `eyJ…`, `supabase.co`, `service_role`, token). Giữ nguyên các tham chiếu trong AGENTS.md §5 / TASKS.md Phase 3.
- Cập nhật HANDOFF: gỡ cảnh báo thứ tự mục, đánh dấu demo đã có, cập nhật trạng thái push.
- Kết quả test: không có code mới; verify bằng `grep -n "^## "`, `diff sort`, `grep` quét secret trên file demo.
- Commit: `docs: sửa thứ tự AGENTS.md (mục 7 xuống cuối) + thêm dashboard-demo.html`.

## 2026-10-19 — Task 1.5: rss-collector (+ _shared/xml.ts) — commit `e0510af`

**1. Việc đã làm**
- Thêm `supabase/functions/_shared/xml.ts`: parser XML tối giản cho RSS 2.0/Atom/RDF — xử lý CDATA, comment, DOCTYPE kể cả internal subset, 5 entity XML + numeric + entity HTML thường gặp, attribute không quote, lột prefix namespace (`dc:creator` → `creator`); XML hỏng thì throw kèm số dòng + offset.
- Thêm `supabase/functions/rss-collector/index.ts`: chạy hết mọi source `type=rss` enabled; mỗi feed 1 try/catch riêng; lọc entry theo `config.last_seen`; `normalize()`; upsert `onConflict(source_id, external_id)`; ghi lại checkpoint.
- Seed 1 row `sources`: `type='rss'`, name="Simon Willison", `config={"url":"https://simonwillison.net/atom/everything/"}`.

**2. Hai thứ lệch so với spec — đã báo trước khi làm (mục 7.7)**
- **`DOMParser` không tồn tại trong Deno 2.9.7** (`typeof DOMParser === "undefined"`, thử cả file `.ts` riêng và `--unstable*`). Đây là API của trình duyệt, Deno không ship DOM. Không thể vừa "dùng DOMParser có sẵn" vừa "không thêm dependency" → Phong chọn tự viết `_shared/xml.ts`. Ghi vào DECISIONS #23.
- **Anthropic không có RSS/Atom chính thức**: 15 URL ứng viên (`/news/rss.xml`, `/rss.xml`, `/feed`, `/news/feed`, `/index.xml`, `/blog/rss.xml`, `/engineering/rss.xml`, `feed.anthropic.com`…) đều 404; trang `/news` không có `<link rel="alternate">` và không chứa chuỗi `feed`; sitemap 566 `<loc>` không có URL feed nào. → chỉ seed Simon Willison, không bịa URL (DECISIONS #28).

**3. Ba chỗ phải sửa khi chạy thật (không phải bịa, do đọc feed thật mới thấy)**
- **author luôn null**: feed Simon Willison có **0/30 entry** khai `<author>`, chỉ khai ở cấp feed → thêm fallback author cấp feed (DECISIONS #24).
- **content bị escape 2 tầng**: Atom để `&amp;lt;script&amp;gt;` → parse xong còn `&lt;script&gt;` → sau khi lột thẻ phải **giải entity lần 2** mới ra `<script>`. Ban đầu làm thiếu bước này nên 6 row hiện `&lt;script&gt;` sai. Thứ tự bắt buộc: lột thẻ trước, giải entity sau (giải trước thì `<script>` vừa hiện ra bị xoá luôn). Ghi vào DECISIONS #26.
- Câu log retry ghi "lỗi mạng" cho cả HTTP 429/5xx → sửa lại cho đúng.

**4. Kết quả test (đã show log)**
- `_shared/xml.ts`: **35/35 pass** — Atom, RSS 2.0 (có DOCTYPE + internal subset + `dc:`), CDATA, entity (XML/numeric/HTML), attr đảo thứ tự/không quote, 4 loại XML hỏng đều throw. Parse feed thật **106 KB trong 6.1 ms**.
- Collector chạy 2 lần: lần 1 `30 entry thô → upsert mới: 30 | bỏ qua do trùng: 0`, checkpoint → `2026-10-18T23:43:09.000Z`; lần 2 `0 entry mới hơn | bỏ qua vì cũ hơn: 30`, `upsert mới: 0`, checkpoint không đổi.
- Chống trùng: xoá `last_seen` chạy lại → `upsert mới: 0 | bỏ qua do trùng: 30`.
- Test nhánh lỗi bằng mock `globalThis.fetch` (DECISIONS #17): **27/27 pass** — 404/410 gọi đúng 1 lần và không ghi checkpoint/không tắt enabled; 429 thử lại 4 lần rồi dừng êm; 500×2 rồi 200 → retry đúng 3 lần và lấy được tin; lỗi mạng thử lại 4 lần; XML hỏng bắt ở cấp source → **5/7 feed vẫn chạy xong**.
- Content sau cùng: 30/30 row có content, dài 186–1001 ký tự, **0 row còn thẻ HTML thật**, 11 row bị cắt 1000 ký tự.
- DB sau task: 3 source (github, hackernews, rss/Simon Willison), **63 item** (33 cũ + 30 rss), mọi `score = 0`.

**5. Lưu ý cho model sau**
- Test nằm ở thư mục tạm, KHÔNG commit (repo vẫn không có file test — giống các task trước).
- Anthropic muốn có tin thì phải scrape HTML `/news` hoặc tìm nguồn thứ ba, KHÔNG đoán URL feed.
- `MAX_CONTENT_CHARS = 1000` trong `rss-collector/index.ts` là hằng số chỉnh được.
- File mới cần cho Phase 2: chưa có. `_shared/xml.ts` chỉ rss-collector dùng.

**6. Việc còn treo**
- `TASKS.md` bị ghi đè mất dấu `[x]` **lần thứ 2** (0.1–0.4, 1.1, 1.2, 1.4) khi Phong cập nhật (lần này thêm Phase 4). Đã re-apply + thêm 1.5. Cần thống nhất cách để không lặp lại.
- 3 commit chưa push: `ef2b0a5`, `f473758`, `a6cfb54` + `e0510af` (code 1.5) + commit docs này = 5.
- Commit: code `e0510af`; docs (mục WORKLOG này) là commit kế tiếp.

## 2026-10-19 — Chốt 2 việc treo của Task 1.5 (Phong duyệt)

- **Test được commit vào repo** (DECISIONS #30). Đã chuyển 2 file test từ thư mục tạm thành dạng `Deno.test`:
  - `supabase/functions/_shared/xml_test.ts` — 5 test (entity, Atom, RSS 2.0/DOCTYPE/`dc:`, XML hỏng, feed thật 106KB).
  - `supabase/functions/rss-collector/index_test.ts` — 1 test / 6 step (retry 404/410/429/500/lỗi mạng, feed chết không ghi checkpoint, cô lập lỗi, content sạch, source thật không bị đụng).
  - Tự viết `eq()`/`throws()`, **không thêm thư viện assert** (AGENTS.md mục 1).
  - Lệnh chạy: `deno test --allow-net --allow-env --allow-read supabase/functions/` → **6 passed (6 steps), 0 failed**.
  - Test nhánh lỗi ghi thật vào DB (tạo/xoá 6 source tên `[TEST] ...`), cần `SUPABASE_SERVICE_ROLE_KEY`. Đã verify sau khi chạy: DB còn đúng 3 source thật, 63 item, không sót row `[TEST]`.
  - Ghi chú kỹ thuật: import `./index.ts` trong test sẽ chạy nhánh `Deno.serve` (vì không có `--once`) nên Deno in "Listening on http://0.0.0.0:8000/" — vô hại, `deno test` vẫn thoát bình thường (đã thử riêng để chắc).
- **TASKS.md**: Phong sẽ sửa trên bản hiện tại (đang có dấu `[x]`) thay vì copy từ bản cũ → không cần re-apply nữa (DECISIONS #31).
- Commit: code test + docs trong cùng commit bàn giao này.

## 2026-10-19 — Sửa test flaky của rss-collector (bug thật, không phải test hỏng vặt)

**Triệu chứng:** chạy `deno test supabase/functions/` thì ~1/3 lần fail ở step "retry: đúng số lần gọi cho từng loại lỗi", luôn cùng dạng `mong đợi: 1 / nhận được: 2`. Chạy riêng file test thì luôn pass. Có lần còn thấy `TypeError: fetch failed` (tức có lúc **fetch thật** bị gọi cho `fake.test`).

**Quá trình tìm (không đoán):**
1. Loại giả thuyết "DB còn row `[TEST]` sót" → query DB: đúng 3 source thật, 0 row `[TEST]`.
2. Loại giả thuyết "import `index.ts` tự chạy collector" → probe đếm số lần fetch `simonwillison.net` trước/sau import: **0** (import không tự chạy).
3. Instrument tạm bằng `console.error` (không bị test runner nuốt output) → thấy rõ **2 lượt `runCollector` chạy ĐỒNG THỜI trong cùng 1 isolate**: mock chỉ cài 1 lần, test body chạy 1 lần, nhưng `network-error` và `ratelimited` bị gọi **8 lần** thay vì 4, `dead` 2 lần, và các lượt gọi xen kẽ nhau rõ rệt.
4. Chỉ còn 1 chỗ gọi được `runCollector` lần nữa: handler `Deno.serve`. Chèn probe vào handler → **bắt tận tay**:
   ```
   GET http://127.0.0.1:8000/health
   user-agent: opencode/latest/2.0.32/cli
   ```

**Nguyên nhân gốc:** `Deno.serve` bind `127.0.0.1:8000`. Test import `index.ts` → server mở → **health-check định kỳ của chính editor (opencode)** gọi `GET /health` → handler chạy thêm 1 lượt `runCollector()` song song với lượt của test → số lần gọi mạng nhân đôi → assert đếm sai. Mọi thứ khác (DB, mock, retry) đều đúng. Vì đây là race với health-check nên mới flaky.

**Cách sửa:** tách logic ra `rss-collector/collector.ts` (thuần logic, import không gây tác dụng phụ), `index.ts` chỉ còn 30 dòng làm entrypoint. Test import `./collector.ts`.

**Kiểm chứng sau khi sửa:**
- `deno check` + `deno lint` sạch.
- Entrypoint `deno run ... index.ts --once` vẫn chạy đúng như cũ.
- Chạy `deno test supabase/functions/` **10 lần liên tiếp → 10/10 pass, 0 fail** (trước đó ~1/3 fail).
- Không còn dấu vết probe trong repo; DB vẫn 3 source thật + 63 item.

**Ghi lại:** DECISIONS #32 (cách sửa) và #33 (2 collector còn lại chưa tách — khi viết test cho chúng phải tách trước, nếu không sẽ dính đúng lỗi này).

- Commit: fix flaky test theo sau commit docs này.
