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

## 2026-10-19 — Task 1.5b: tách `github-collector` + `hackernews-collector` (đóng cảnh báo #33)

**Mục đích:** mọi collector đều có `collector.ts` import không tác dụng phụ, để sau này viết test không dính bẫy health-check như rss-collector đã gặp (#32).

**Việc đã làm (chỉ di chuyển code, KHÔNG đổi nghiệp vụ):**
- `github-collector/collector.ts` = 9 dòng header + **toàn bộ logic** (nguyên bản `index.ts` dòng 5–285, byte-identical); `github-collector/index.ts` = 29 dòng entrypoint (`--once` → `runCollector()`, ngược lại → `Deno.serve`).
- `hackernews-collector/collector.ts` = 9 dòng header + logic (nguyên bản dòng 5–271, byte-identical); `index.ts` = 29 dòng entrypoint.
- `LOG` khai lại ở cả `collector.ts` và `index.ts` — giống hệt cách rss-collector đang làm.

**Cách kiểm chứng "log khớp hành vi trước tách" (không chỉ chạy suông):**
1. **Chụp baseline TRƯỚC khi tách:** xoá `last_seen` của từng source rồi `--once` → lượt chạy này đi hết đường fetch→normalize→upsert (không phải nhánh "0 mới"). Lưu log.
2. Tách xong, xoá `last_seen` lần nữa, chạy lại → `diff` (bỏ mốc thời gian) → **khớp hoàn toàn** cả 2 collector.
3. So phần logic với bản gốc trong git bằng `diff` → **byte-identical** (chỉ khác header comment, đã verify).
4. Chạy `--once` bình thường (checkpoint nguyên): github `19/0/19`, HN `0/0/0` — đúng như cũ.
5. `deno check` + `deno lint` (12 file) sạch; `deno test --allow-net --allow-env --allow-read supabase/functions/` → **6 passed**.

**Log đối chiếu github:** `fetch: 19 repo | upsert mới: 0 | bỏ qua do trùng: 19` — trước và sau tách **giống hệt**.
**Log đối chiếu hackernews:** `fetch: 19 story thô | 15 story duy nhất sau khi gộp query | upsert mới: 0 | bỏ qua do trùng: 15` — trước và sau tách **giống hệt**.

**Ghi chú DB:** khi xoá `last_seen` để chụp baseline, HN quét rộng về 7 ngày nên nhặt thêm **1 story thật** chưa có → DB từ 63 → **64 items** (github 19 + hackernews 15 + rss 30). Item này hợp lệ, không phải rác test.

- Commit: `da64117` (github) + `241dd4f` (hackernews) — mỗi collector 1 commit riêng theo yêu cầu.

## 2026-10-19 — Task 1.6: `ingest-facebook` (endpoint nhận JSON từ Merlin)

**Bối cảnh:** Merlin quét 3 group Facebook bằng lịch riêng rồi POST vào backend (ARCHITECTURE.md). Repo **không có spec field-level** cho payload → endpoint được thiết kế **khoan dung** (nhận 3 dạng body + alias field rộng) để không vỡ khi Merlin bắn thật (DECISIONS #36/#37).

**Đã làm:**
- `supabase/functions/ingest-facebook/ingest.ts` = logic (import không side-effect): `IngestResult`, `checkSecret`, `ingestPosts`, `ingestFacebook`; `index.ts` = entrypoint (`Deno.serve` + cờ `--once <file.json>`) — theo pattern #32/#34.
- Auth: header **`x-ingest-secret`** so timing-safe với env `INGEST_SECRET`; thiếu env → 500 (fail closed). **Tắt `verify_jwt`** cho riêng function qua `supabase/config.toml` (Merlin không có JWT Supabase).
- `README.md` = **hợp đồng dữ liệu cho Merlin** (field + alias + curl mẫu + bảng mã lỗi + danh sách group đã seed); `sample-payload.json` để test local.
- Seed 3 source `type=facebook`: Vibe Code kiếm cơm `1385451906420187`, Antigravity VN `1522144709086429`, Cộng đồng Claude AI & AI Agents Việt Nam `861108920047086` — `config = { group_id, group_url }`.
- `.env.example` thêm `INGEST_SECRET=`; `.env` local đã có secret 64 hex (đã verify `.env` bị gitignore).

**Test (show log):**
1. `--once sample-payload.json` lần 1 → `nhận 3 | hợp lệ 3 | mới 3 | trùng 0 | bỏ 0`; lần 2 → `mới 0 | trùng 3`.
2. Payload biên: group lạ → `unknown_groups:["9999999999"]` + bỏ bài; thiếu `post_id` → bỏ; `text` rỗng → bỏ; alias (`from:{name}`→author, `likes`→reactions, `num_comments`→comments, `timestamp` ms→ISO, `permalink` tương đối→ghép host, `group` khớp theo **tên**) đều OK; bọc `{items:[...]}` OK; 1 bài lẻ OK.
3. HTTP thật (server nền cổng 8000): `GET /` → 200 health; POST thiếu secret → 401; sai secret → 401; `PUT` → 405; JSON hỏng → 400; POST đúng secret với 2 bài trùng `post_id` trong cùng request → `mới 1 | trùng 1`; POST lại → `mới 0 | trùng 1`.
4. `deno check` + `deno lint` (14 file) sạch; `deno test supabase/functions/` → 6 passed.
5. Xoá 6 row test → DB về đúng **64 items**.

**Bug bắt được khi test HTTP (DECISIONS #38):** lô trộn bài có/không có tương tác → `null value in column "engagement"` — vì PostgREST bulk-upsert **điền NULL cho row thiếu key** (bỏ qua column default `'{}'`). Fix: luôn gửi `engagement` object (kể cả `{}`), không để `undefined`. Test `--once` với payload mẫu **không lộ** bug này — chỉ test HTTP lô trộn mới lộ.

- Commit code: `dba3082` (kèm `supabase/config.toml` + `.env.example`).

**Chờ:** Phong set `INGEST_SECRET` vào Supabase secrets rồi deploy function với `verify_jwt=false`, sau đó Merlin bắn dữ liệu thật.

## 2026-10-19 — Task 2.1: `_shared/scoring.ts` (chấm điểm + cổng T2 + luật báo ngay)

**Mục đích:** biến tiêu chí 3 tầng (AGENTS.md mục 6) thành lib thuần túy để `run-cycle` (2.0) và `notify-telegram` (2.2) dùng. Không import Supabase, không đọc/ghi DB, không gọi mạng → test offline, tất định.

**Đã làm — `supabase/functions/_shared/scoring.ts`:**
- Export `ScoreInput`, `ScoreResult`, `ScoreBreakdown`, `EngagementMetrics`, `SourceType`, `MAX_SCORE`, `scoreItem(input, now = new Date())`.
- **Cổng T2 chạy trước:** FB reactions+comments < 15; Reddit upvotes < 30 hoặc ratio < 0.75; HN points < 30 → `passed=false`, `score=0`, breakdown toàn 0, không chấm tiếp, `notify_now=false`. GitHub/RSS luôn qua (collector đã lọc).
- **Topic 0–40:** `matchKeywords(title + ' ' + content).score`, dùng thẳng (không tự chế lại).
- **Engagement 0–30:** nội suy tuyến tính pass→5, hot→30 (FB 15/80, Reddit 30/200, GitHub 50/500, HN 30/100); kẹp 5..30; RSS cố định 15. Metric FB = reactions+comments.
- **Recency 0–20:** <6h→20, <12h→15, <24h→10, <48h→5, còn lại 0; ngày tương lai → 0h; ngày không parse được → 0.
- **Cross-source 0–10:** chỉ nhận cờ `cross_source` (việc truy DB là của run-cycle).
- **`notify_now`:** (a) nhóm A + <24h; (b) cross_source=true; (c) nhóm A + ngưỡng hot của nguồn (FB≥80, Reddit≥200, GitHub≥500, HN≥100). Nhóm A xác định bằng `matchKeywords(...).group === "A"` (đọc `KEYWORDS`), không chỉ xét điểm. Reason gộp bằng `"; "`.
- Làm tròn từng thành phần → `score` đúng bằng tổng breakdown, khớp cột `items.score` integer (DECISIONS #39).

**Test — `_shared/scoring_test.ts` (11 test, offline, không cần env):**
1. nhóm A + FB hot 80, 2h → score 90, `notify_now=true`, reason có "nhóm A" + "hot".
2. `"bán tool giá rẻ inbox"` → topic 0; thêm ca `"tool mới giá rẻ inbox"` (C 20 − 30 → 0).
3. FB 10 react (7+3) → `passed=false`, `score=0`, breakdown 0, không báo dù nhóm A + cross_source.
4. recency đúng biên 5.9/6/11.9/12/23.9/24/47.9/48/49h + tương lai.
5. RSS → engagement đúng 15, bỏ qua stars/points thô.
6. cross_source=true → +10 đúng, có reason cross-source.
7. Hồi quy 1.1b: `"Đánh giá tool mới"`→20, `"Không bán token free"`→40; `"…, giá siêu rẻ"`→0; `"…, inbox"`→10.
8. Biên cổng T2 cả 5 nguồn (FB 14/15, Reddit ratio 0.74/0.75, HN 29/30, GitHub/RSS 0 tương tác vẫn qua).
9. Nội suy: pass→5, giữa→18, hot→30, vượt hot kẹp 30; GitHub <50 kẹp 5.
10. Notify đủ luật a/b/c + các ca không báo (A nhưng 30h & không hot, RSS >24h, không nhóm A dù hot, tin bị loại).
11. Bất biến: score = tổng breakdown, 0..100, JSON round-trip; ca max A+hot+<6h+cross = 100.

**Log chạy:**
```
deno check supabase/functions/ → Checked 16 files (sạch)
deno lint  supabase/functions/ → Checked 16 files (sạch)
deno test supabase/functions/_shared/scoring_test.ts → 11 passed | 0 failed
deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/
  → 17 passed (6 steps) | 0 failed   [11 scoring + 5 xml + 1 rss/6 step]
```

- Commit code: `79485ce` (chỉ 2 file mới: `scoring.ts` + `scoring_test.ts`; không đụng `config.toml` đang thay đổi ngoài task).
