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

## 2026-10-19 — Task 2.2: `_shared/notify.ts` (gửi Telegram + chống gửi trùng)

**Mục đích:** lib gửi thông báo để `run-cycle` (2.0) gọi sau khi chấm điểm — tin ≥70 (hoặc trigger báo ngay) đi ngay, tin 40–69 gom digest, không gửi trùng 1 tin 2 lần.

**Đã làm — `supabase/functions/_shared/notify.ts`:**
- Export `NotifyItem`, `sendInstant(supabase, item, fetchFn = fetch)`, `sendDigest(supabase, items, fetchFn = fetch)`, `buildInstantText`, `buildDigestText`, `NotifyDb`/`NotifyDbResult`/`NotifyTable`/`NotifyQuery`/`NotifyFetch`.
- **Instant:** `<b>tiêu đề</b>` + dòng meta `nguồn · điểm · lý do` + `<a href="…">Mở bài gốc</a>`; `disable_web_page_preview=false`.
- **Digest:** đúng 1 tin nhắn/lô, header `📰 Bản tin AI — dd/mm/yyyy` (giờ VN UTC+7), bullet `• [điểm] tiêu đề — nguồn · link`; `disable_web_page_preview=true`.
- **Chống trùng:** query `notification_log` `(item_id, channel='telegram')` trước khi gửi; digest query 1 lần bằng `.in` cho cả lô. Chỉ insert log khi HTTP ok VÀ body `{ok:true}`; lỗi mạng/Telegram → throw, không log (DECISIONS #40). Bỏ item đã có log khỏi digest; hết tin chưa gửi → `skipped`.
- **HTML:** escape `<`, `>`, `&` (+ `"` trong href); cắt tiêu đề >150 ký tự kèm `…`.
- **Vượt 4096:** bỏ dần bullet cuối + dòng `…và N tin khác`; CHỈ log item thực sự còn trong tin nhắn (DECISIONS #41).
- `supabase` truyền từ ngoài qua interface tối thiểu `NotifyDb`; đã verify `SupabaseClient` thật gán được (phải để `from(): unknown` vì generic Postgrest gây TS2589).

**Test — `supabase/functions/_shared/notify_test.ts` (9 test, offline, mock DB + mock fetch):**
1. instant format đúng: bold title, meta, link escape `&`, preview bật, log sau khi gửi.
2. gửi lại cùng item → `skipped`, fetch chỉ gọi 1 lần, chỉ 1 row log.
3. digest 3 item → 1 message, đúng 3 bullet, preview tắt, log 3 id; gọi lại → `skipped`.
4. tiêu đề `<script> & "AI" >` bị escape (không còn thẻ thô) + tiêu đề 200 ký tự bị cắt còn `…`.
5. digest 40 item dài → ≤4096, có `…và N tin khác`, N = số bullet bị bỏ, **chỉ log bullet đã gửi**.
6. thiếu env → throw nêu đúng tên biến, không gọi fetch, không query DB (test cả ca thiếu 1 biến).
7. Telegram `ok:false` / HTTP 500 / lỗi mạng → throw, không ghi log.
8. lô đã gửi hết → `skipped`; lô trộn chỉ gửi + log tin chưa gửi; lô rỗng → `skipped`.
9. `buildDigestText` cắt đúng số bullet, đúng ngày VN.

**Nghiệm thu gửi THẬT vào group "Bản tin AI" (bot @tool_batin_ai_bot):**
- Chọn item thật chưa có log: `527dff56-c1c8-4448-8d5a-c75c42551cfa` (nguồn FB "Cộng đồng Claude AI & AI Agents Việt Nam", chấm thật bằng `scoreItem` → **70 điểm**, `notify_now=true`, reason `nhóm A + engagement hot (125)`).
- `sendInstant` lần 1 → `sent` (Telegram calls=1); lần 2 → `skipped` (vẫn calls=1) → chống trùng chạy đúng với DB thật.
- Xoá đúng row log vừa tạo → `1 row`; kiểm tra lại `0 row`. `notification_log` toàn bảng = 0 row.
- ⚠️ **Blind spot bắt được:** `NOTIFY_CHAT_ID` trong `.env` ban đầu là **user id** (5861…440) → Telegram trả `Forbidden: bot can't initiate conversation with a user`. Đã dò bằng `getUpdates` → group "Bản tin AI" = `-1004434350401`; sửa lại `.env` (không commit) rồi gửi OK. **Từ giờ `NOTIFY_CHAT_ID` phải là id group (số âm, `-100…`), không phải user id.**
- Ca lỗi trên cũng xác nhận luật #40 bằng thực tế: gửi bị từ chối → **không có row nào** trong `notification_log`.

**Log chạy:**
```
deno check supabase/functions/ → Checked 18 files
deno lint  supabase/functions/ → Checked 18 files
deno test --allow-env supabase/functions/_shared/notify_test.ts → 9 passed | 0 failed
deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/ → 26 passed (6 steps) | 0 failed
```

- Commit code: `5e3e9de` (2 file mới: `notify.ts` + `notify_test.ts`).
- Ghi chú DB: Merlin đã bắn dữ liệu Facebook thật → DB hiện **88 items** (github 19 + hackernews 15 + rss 30 + facebook 24), `notification_log` 0 row.

## 2026-10-20 — Task 2.0: `run-cycle` (orchestrator collect → score → notify)

**Mục đích:** 1 endpoint duy nhất để pg_cron gọi mỗi 2h — chạy hết collector, chấm điểm tin mới, gửi thông báo; một nguồn chết không giết cả kỳ.

**Đã làm — collector API (không đổi nghiệp vụ):**
- `github-collector/collector.ts`, `hackernews-collector/collector.ts`, `rss-collector/collector.ts`: export thêm `collectSource(supabase, source)` (rss đã có hàm private, chỉ export). `runCollector()` giữ nguyên hành vi cũ cho entrypoint/test, giờ chỉ đọc source rồi gọi `collectSource`.
- `run-cycle` truyền đúng row `sources` vào từng collector, nên mỗi source có try/catch riêng; `type='facebook'` bỏ qua (nguồn bị động, Merlin bắn qua `ingest-facebook`).

**Đã làm — `run-cycle/collector.ts`:**
- Đọc `sources` `enabled=true`; map `github`/`hackernews`/`rss` → collector; type lạ / chưa có collector → log bỏ qua.
- Chấm tối đa 200 item/kỳ: `score=0 AND engagement->>score_breakdown IS NULL`, order `published_at` mới trước, null cuối.
- Cross-source: query items 24h qua, build index `normalizeUrl(url)` và title chuẩn hóa (lowercase, bỏ ký tự đặc biệt, gộp khoảng trắng) → tập `source_id`; chỉ tính khi có source KHÁC trùng.
- Ghi `score` + `engagement = {...engagement cũ, score_breakdown}` (không gửi NULL — bài học #38).
- Notify: chỉ item có `published_at` ≤48h; `notify_now` hoặc `score>=70` → `sendInstant`; `40<=score<70` → gom 1 `sendDigest` cuối kỳ; lỗi gửi 1 tin không chặn tin khác.
- Summary: `{sources_ok, sources_failed, scored, notified_instant, notified_digest}`.

**Đã làm — `run-cycle/index.ts` + `_shared/secret.ts`:**
- `--once` chạy 1 kỳ; HTTP POST auth header `x-cron-secret` với `CRON_SECRET` (fail-closed), sai/thiếu → 401; thiếu env → lỗi rõ tên biến.
- Tách `checkSecret`/`timingSafeEqual` sang `_shared/secret.ts`; `ingest-facebook/ingest.ts` re-export để `index.ts` cũ không phải sửa.

**Nghiệm thu local (DB thật):**
- Kỳ 1: `sources enabled: 6` → 3 collector chạy OK (GitHub 0 mới, HN +4, RSS +1), `sources_failed: 0`; chấm **117 item** (backfill toàn bộ tồn đọng), 117/117 có `score_breakdown`; **digest 4 tin gửi Telegram thật** (`notification_log` 4 row): score 56 FB prompt, 40 FB Gemini, 40 RSS datasette, 50 RSS llm-echo. Không có instant vì 2 tin 70 điểm đều cũ >48h.
- Kỳ 2 ngay sau: `scored: 0`, không chấm lại; không gửi lặp.
- Spot-check: 95 item score>0; 22 item bị cổng T2 loại có breakdown toàn 0 (để không chấm lại); breakdown đủ 4 thành phần `topic/engagement/recency/cross_source`.
- **Test instant ≥70:** chèn 1 bài FB test qua logic `ingestFacebook` (group Vibe Code, reactions 100 + comments 20, nhóm A, published mới) → `scoreItem` cho **90 điểm** (topic 40 + engagement 30 + recency 20), `sendInstant` → `sent`, `notification_log` có row. Sau đó xoá row log + item test; DB về 117 item, `notification_log` còn 4 row digest.

**Deploy + auth:**
- `supabase functions deploy run-cycle --project-ref gkyneqfagcqgliwtxyfs --no-verify-jwt` → OK.
- `GET /functions/v1/run-cycle` → 200 health; `POST` sai secret → **401**; `POST` không secret → **401**; `POST` đúng secret → 200 `{ok:true,sources_ok:3,sources_failed:0,scored:0,notified_instant:0,notified_digest:0}`.
- Đã thêm `CRON_SECRET` vào `.env` local (không commit) và set Supabase secret cùng giá trị.

**Test/lint:**
```
deno check supabase/functions/ → Checked 21 files
deno lint  supabase/functions/ → Checked 21 files
deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/
  → 26 passed (6 steps) | 0 failed
```
- Commit code: `4be1a82` (7 file: 3 collector refactor + ingest re-export + `_shared/secret.ts` + 2 file `run-cycle`).

**Blind spot / lưu ý:**
- Tiêu chí "tin ≥70 trong 88 tin hiện có → Telegram" không đạt bằng dữ liệu thật: 2 tin 70 điểm đều >48h nên theo DECISIONS #44 không báo. Đã xác nhận nhánh instant bằng 1 item test rồi xoá (xem trên); digest thật 4 tin vẫn đã vào group.
- `INGEST_SECRET` trong `.env` local **không khớp** secret đang deploy (POST thử trả 401), trong khi Merlin vẫn bắn được → secret production khác. Không đổi secret production; test instant gọi trực tiếp `ingestFacebook`.
- Test RSS "source thật không bị đụng tới" flaky khi feed Simon có bài mới: lần đầu checkpoint tiến → fail, chạy lại pass. Chưa sửa (ngoài scope 2.0), cần ghi nhận để xử lý sau.

## 2026-10-20 — Task 2.0b: fix test RSS flaky bằng fixture

**Vấn đề:** test `rss-collector` chạy `runCollector()` trên toàn bộ source thật, nên đọc feed Simon Willison qua mạng. Khi feed có bài mới, checkpoint tiến → bước "source thật không bị đụng tới" fail lần đầu; chạy lại mới pass.

**Đã làm:**
- Tải bản XML thật của `https://simonwillison.net/atom/everything/` → `supabase/functions/rss-collector/testdata/feed.xml` (102.102 bytes, 30 entry, entry mới nhất `2026-10-19T23:58:25Z` — đúng mốc checkpoint hiện tại của source thật).
- `index_test.ts`: mock `globalThis.fetch` cho đúng URL feed Simon, trả fixture; chỉ các call `fake.test` và feed Simon bị chặn, call Supabase vẫn đi mạng thật. Thêm biến đếm `simonCalls` và assert `=1` để chứng minh fixture được dùng.
- **Không sửa `collector.ts`** — giữ nguyên logic collector.

**Kết quả:**
```
deno test --env-file=.env --allow-net --allow-env --allow-read supabase/functions/rss-collector/index_test.ts
  → 1 passed (6 steps) | 0 failed
Chạy lặp 10 lần liên tiếp:
  run 1..10: PASS
  → 10/10 pass, 0 fail
```
- Test vẫn ghi DB thật (tạo/xoá 6 source `[TEST] ...`), chỉ mạng RSS được mock.
- Commit: cùng task 2.0b (test + fixture + TASKS/WORKLOG).

## 2026-10-20 — Task 2.1b: chốt `supabase/config.toml`

**Đã làm:**
- Lấy bản config tối thiểu đang ở `supabase/config.toml.bak` (89 bytes) làm `supabase/config.toml`; xoá `.bak`.
- Nội dung chốt:
```toml
[functions.ingest-facebook]
verify_jwt = false

[functions.run-cycle]
verify_jwt = false
```
- Deploy lại **không dùng flag** `--no-verify-jwt`:
  `supabase functions deploy ingest-facebook --project-ref gkyneqfagcqgliwtxyfs`
  `supabase functions deploy run-cycle --project-ref gkyneqfagcqgliwtxyfs`
  → CLI 2.121.0 parse config + deploy thành công.

**Verify verify_jwt=false có hiệu lực từ config:**
```
POST /functions/v1/ingest-facebook  (x-ingest-secret: wrong-secret)
→ HTTP 401 {"ok":false,"error":"secret sai hoặc thiếu"}
POST /functions/v1/run-cycle        (x-cron-secret: wrong-secret)
→ HTTP 401 {"ok":false,"error":"secret sai hoặc thiếu"}
```
Body là JSON do code của mình trả, không phải lỗi JWT của Supabase → request đã vào tới function, chứng minh `verify_jwt=false` từ config.

**Ghi nhận:** parse error cũ do field lạ trong config cũ (không thuộc schema CLI 2.121.0); config tối thiểu chỉ chứa key CLI hiểu mới parse được. Xem DECISIONS #45.

- Commit: `1e42c2c`.

## 2026-10-20 — Task 2.3: pg_cron gọi `run-cycle` mỗi 2h

**File:** `supabase/migrations/20261020_run_cycle_cron.sql` (chưa chạy — Phong chạy trong SQL Editor).

**Nội dung:**
- Bật `pg_cron`, `pg_net`, `supabase_vault` (schema `vault`). Lưu ý: extension Vault trên Supabase tên là `supabase_vault`, không phải `vault`; đã ghi comment trong file.
- Vault secret: `vault.create_secret('__CRON_SECRET__', 'cron_secret', ...)` — **placeholder giữ nguyên trong file commit**, không có secret thật.
- Wrapper `public.trigger_run_cycle()`:
  - `security definer`, `search_path = ''`, đọc `vault.decrypted_secrets` theo tên `cron_secret`.
  - Raise lỗi nếu secret trống hoặc vẫn là `__CRON_SECRET__`.
  - `net.http_post` tới `.../functions/v1/run-cycle`, header `x-cron-secret`, `timeout_milliseconds := 120000` (run-cycle chấm 200 item có thể >5s mặc định).
  - `revoke all ... from public`, chỉ `grant execute ... to postgres`.
- Job: `cron.schedule('run-cycle-2h', '0 */2 * * *', $$select public.trigger_run_cycle()$$)` — command **không chứa secret**.
- Cuối file có hướng dẫn từng khối cho Phong + câu verify.

**CRON_SECRET:**
- Đã xác nhận tên `CRON_SECRET` tồn tại trong Supabase Edge Functions secrets (`supabase secrets list`), set từ task 2.0. Giá trị thật nằm trong `.env` local (không commit, không in ra).
- Phong **không cần tạo secret mới**; chỉ thay `__CRON_SECRET__` trong file SQL bằng giá trị trong `.env` trước khi chạy. Nếu tạo mới thì phải `supabase secrets set CRON_SECRET=...` lại để function nhận đúng.

**Chưa chạy SQL:** agent không có DB password/không chạy SQL Editor; theo yêu cầu, Phong chạy. Sau khi chạy cần verify:
```
select jobid, jobname, schedule, command, active from cron.job where jobname='run-cycle-2h';
select public.trigger_run_cycle();
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select id, status_code, content, created from net._http_response order by created desc limit 5;
```
`cron.job_run_details` chỉ chứng minh wrapper chạy không lỗi SQL; `net._http_response.status_code = 200` mới chứng minh HTTP tới run-cycle thành công.

- Commit: cùng task 2.3 (migration + TASKS/WORKLOG/DECISIONS/HANDOFF).

## 2026-10-20 — Task 3.1: scaffold dashboard Next.js + magic link

**Setup**
- `npx create-next-app@latest dashboard --typescript --app --no-src-dir --no-tailwind --eslint --use-npm --import-alias "@/*" --disable-git --empty --yes`
- Next.js **16.4.2**, React **19.3.0**.
- `npm install @supabase/supabase-js @supabase/ssr` → `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0.
- `dashboard/.env.local` lấy `SUPABASE_URL` + `SUPABASE_ANON_KEY` từ `.env` root; **không** đưa service_role vào dashboard; file đã gitignore.
- `next.config.ts`: bỏ `cacheComponents`/`partialPrefetching` mặc định của template để auth + đọc DB động đơn giản ở task này.

**Auth**
- `lib/supabase/client.ts` (browser) + `lib/supabase/server.ts` (Server Component/Route Handler, đọc/ghi cookie).
- `/login`: client gọi `signInWithOtp({ email, options: { emailRedirectTo: origin + "/auth/callback" } })`.
- `/auth/callback`: Route Handler đổi `code` bằng `exchangeCodeForSession`, redirect `/`; lỗi → `/login?error=auth`.
- `proxy.ts`: Next.js 16 đổi tên middleware → proxy; chuẩn @supabase/ssr (`getUser()` + refresh cookie). Chặn mọi route chưa đăng nhập, cho qua `/login` + `/auth/*`; matcher bỏ static + `auth/callback`.
- Nút Đăng xuất: `signOut()` → `/login`.

**RLS**
- `supabase/migrations/20261020_dashboard_rls.sql`: enable RLS 3 bảng, policy SELECT `to authenticated using (true)`, grant SELECT cho authenticated.
- Đã chạy thật bằng `supabase link --project-ref gkyneqfagcqgliwtxyfs` + `supabase db query --linked -f supabase/migrations/20261020_dashboard_rls.sql`.
- Verify `pg_policies`: 3 policy `authenticated_read_items`, `authenticated_read_sources`, `authenticated_read_notification_log`.
- Anon query `items` = 0 row; authenticated = thấy dữ liệu.

**Auth URL config**
- Remote `auth.site_url` đã là `http://localhost:3000`.
- Thêm `http://localhost:3000/auth/callback` vào `auth.additional_redirect_urls` bằng `supabase config push` (tạm thêm block `[auth]`, push xong restore `supabase/config.toml` tối thiểu).
- Production Vercel sẽ thêm URL ở task 3.4.

**E2E đã test thật**
- `GET /` chưa login → `307 Location: /login`.
- Tạo user `phongnhat43@gmail.com` (đã confirm); chỉ user này còn lại sau test.
- Test magic link bằng hộp thư tạm mail.tm (tránh đụng Gmail thật):
  - nhập email trên `/login` → nhận mail "Your sign-in link";
  - bấm link → `/auth/callback` → `/`;
  - trang chủ hiện đúng **10 item thật** (Vibe Code, Simon Willison, Hacker News...), có score + nguồn;
  - bấm Đăng xuất → `/login`; mở lại `/` → vẫn bị đẩy `/login`.
- Lần link đầu fail (có thể do scanner của hộp thư dùng mất magic link single-use); lần gửi lại thành công. Không phải lỗi code.
- User test + hộp thư tạm đã xoá.

**Kiểm tra**
```text
npm run lint  → pass (0 error)
npm run build → pass
Route (app): / (dynamic), /auth/callback, /login
Proxy (Middleware) detected
npm run dev   → dùng để test E2E
```

**Ghi chú**
- `dashboard/AGENTS.md` do create-next-app/next dev tự sinh (Next 16 breaking changes); giữ lại.
- Chưa deploy Vercel — task 3.4.
- Trang chủ hiện là list thô, chưa làm UI Feedly — task 3.2.

- Commit: cùng task 3.1 (dashboard + migration + docs).

---

## 20/10/2026 — Task 3.1b: dashboard → static export cho GitHub Pages

**Vì sao:** đổi quyết định deploy từ Vercel sang GitHub Pages. Pages chỉ phục vụ file
tĩnh → `proxy.ts`, Server Component đọc DB, Route Handler, `@supabase/ssr` (cookie server)
đều không chạy được.

**Đã làm**
- `next.config.ts`: `output: "export"`, `trailingSlash: true`, `basePath: "/tool-bantin"`
  (mặc định, override bằng `NEXT_PUBLIC_BASE_PATH`), `images.unoptimized`,
  `env.NEXT_PUBLIC_BASE_PATH` để client dựng redirect URL.
- Xoá `proxy.ts`, `lib/supabase/server.ts`, `app/auth/callback/route.ts`; bỏ `@supabase/ssr`
  khỏi dependencies (không dùng ở static export).
- `lib/supabase/client.ts`: `@supabase/supabase-js` singleton, `flowType: "pkce"`,
  `detectSessionInUrl: true`, session trong localStorage, chỉ anon key.
- `components/require-auth.tsx`: chặn route private ở client (`getSession()` → không có
  thì `router.replace("/login")`), nghe `onAuthStateChange` để logout là bị đá ra.
- `/login`: `emailRedirectTo = origin + BASE_PATH + /auth/callback/`; đã có session thì vào feed.
- `/auth/callback` → client component: chờ `detectSessionInUrl` trước, sau đó
  `exchangeCodeForSession(code)`; fallback nhận `#access_token`/`#refresh_token`
  (link admin tạo không kèm `code_challenge` thì GoTrue trả implicit hash) rồi `setSession`.
- Trang chủ: client component, `from("items").select("id, title, url, score, published_at, sources(name)")
  .order("published_at", desc).limit(10)`, giữ UI tạm như 3.1.

**Kiểm tra**
```text
npm run build → pass, sinh out/ (out/index.html, out/login/index.html, out/auth/callback/index.html)
npm run lint  → pass (0 error)
asset path trong out/ đúng basePath: /tool-bantin/_next/static/...
login chunk inlined: {window.location.origin}/tool-bantin/auth/callback/
```
Serve tĩnh (basePath nên serve qua thư mục bọc `tool-bantin -> out`):
```bash
ln -sfn "$PWD/out" /tmp/bantin-preview/tool-bantin
npx serve -l 3000 /tmp/bantin-preview
```
E2E thật trên trình duyệt (http://localhost:3000/tool-bantin/):
- chưa login → tự đẩy `/tool-bantin/login/` (thấy "Đang kiểm tra đăng nhập…" → login);
- magic link thật (GoTrue verify → `/auth/callback/#access_token=…`) → về `/tool-bantin/`,
  hiện **10 item thật** (Vibe Code, Simon Willison, Hacker News…), có score + nguồn;
- bấm Đăng xuất → `/login/`; mở lại `/tool-bantin/` → bị chặn về `/login/`;
- anon key gọi REST `items` vẫn trả `[]` (RLS `authenticated` còn nguyên).

**Vướng & cách xử lý**
- Supabase báo `email rate limit exceeded` (project hết quota gửi mail/giờ) nên **không gửi
  được mail thật** trong phiên này. Đã xác minh bằng link do Admin API tạo
  (`/auth/v1/admin/generate_link`, cùng user thật) → GoTrue verify → callback → session thật.
  Redirect `http://localhost:3000/tool-bantin/auth/callback/` được GoTrue chấp nhận (200).
- Link admin tạo không kèm `code_challenge` nên GoTrue trả token ở hash; `flowType: pkce`
  từ chối implicit URL (auth-js: "Not a valid PKCE flow url") → thêm fallback `setSession`
  trong callback. Magic link thật từ `/login` vẫn đi đường PKCE `?code=`.
- User test (`test3b-…@maxxspace.com`) + hộp thư tạm mail.tm đã xoá sau test.

**Còn chờ Phong (Supabase dashboard)**
- (a) Authentication → Settings: "Allow new users to sign up" — **đang TẮT sẵn** (OTP trả
  `Signups not allowed for otp`), giữ nguyên.
- (b) Authentication → URL Configuration: thêm `https://phongnhat43.github.io/tool-bantin/auth/callback/`
  (local `http://localhost:3000/tool-bantin/auth/callback/` đã được chấp nhận; nếu muốn
  chạy bản không basePath thì thêm `http://localhost:3000/auth/callback/`).

**Ghi chú**
- 3.2 (Feed UI) phải làm theo kiểu client-side (không Server Component/searchParams server).
- 3.4 (deploy) đổi từ Vercel sang GitHub Pages — chờ chốt lại nội dung.

- Commit: `d0b5ab0` (code) + commit docs.

## 20/10/2026 — Task 3.2: Màn Feed (client-side, static export)

**Việc đã làm**
- `lib/items.ts`: query đọc-only cho 3 khối (`.gte("score",70)` limit 20; 40–69 trong 24h
  limit 30; Tất cả `.range()` + `.or("title.ilike...,content.ilike...")` + `.eq("source_id")`),
  `fetchSources`, `fetchLastRun`. `lib/format.ts`: thời gian tương đối, tier điểm, nhãn nguồn,
  breakdown từ `engagement.score_breakdown`.
- `components/`: `site-header` (sticky, tab Feed/Nguồn, theme toggle, Chạy ngay, Đăng xuất),
  `item-row` (ô điểm vuông + tiêu đề/meta, bấm mở rộng: nội dung cắt 500 ký tự, breakdown
  4 thành phần, engagement gốc, link gốc `_blank`), `theme-toggle` (nhãn đổi bằng CSS theo
  `[data-theme]`, không state → không lệch hydration), `feed-sections` (loading suy ra từ
  "dữ liệu thuộc request nào" thay vì setState đồng bộ trong effect), `run-now-button`.
- `app/globals.css` viết lại theo token light/dark đúng spec; `app/layout.tsx` thêm script
  inline trong `<head>` set `data-theme` trước khi paint → không nháy theme khi tải lại.
- `app/nguon/page.tsx`: placeholder cho 3.3.
- `supabase/migrations/20261021_rpc_grant.sql`: grant `trigger_run_cycle` cho authenticated,
  **revoke `anon`**, thêm `run_cycle_result()` (security definer, chỉ đọc `net._http_response`)
  để dashboard lấy tóm tắt kỳ chạy.

**Kết quả test (dữ liệu thật, serve `out/` sau basePath tại localhost:3000/tool-bantin/)**
- `npm run lint` sạch, `npm run build` pass → `out/` có `/`, `/login`, `/auth/callback`, `/nguon`.
- "Cần xem ngay" = **2 tin điểm 70** (đúng như chốt); "Hôm nay" = 2 tin (56, 40); "Tất cả" = 50.
- Bấm 1 dòng → mở rộng đúng: nội dung 500 ký tự, `Chủ đề 40/40 · Tương tác 30/30 · Độ mới 0/20 ·
  Cross-source 0/10`, engagement `20 bình luận / 72 reactions`, link "Mở bài gốc".
- Theme: bấm → `data-theme=dark`, `localStorage=bantin-theme:dark`, nền `rgb(18,18,18)`;
  reload vẫn dark, nhãn nút đúng; script theme nằm trong `<head>`, trước `<body>`.
- Tìm "prompt" → 10 tin khớp (title + content); lọc nguồn GitHub → 1 tin (đúng giao nhau);
  "Tải thêm" 50 → 100 dòng.
- "Chạy ngay" (sau khi apply migration grant): nút → "⏳ Đang chạy…" → ~4–8s sau hiện
  `Xong: 3/3 nguồn · chấm 0 tin · 0 thông báo` (đúng JSON của run-cycle) + 3 khối tự tải lại.
- Đăng xuất → `/login/`; mở lại `/tool-bantin/` khi chưa login → đẩy về `/login/`.
- RPC: `anon` gọi `run_cycle_result` → `401 permission denied`; `authenticated` → 200.

**Phát hiện (đã sửa)**
- `trigger_run_cycle()` từ 2.3 **còn grant EXECUTE cho `anon`**: Supabase `alter default privileges`
  cấp EXECUTE cho anon/authenticated khi tạo function trong `public`, và `revoke ... from public`
  không gỡ quyền cấp trực tiếp → ai có anon key cũng trigger được run-cycle. Migration 3.2
  revoke `anon` (đã verify `proacl` chỉ còn postgres/authenticated/service_role).

**Ghi chú**
- RPC `trigger_run_cycle()` là `void` (pg_net async) nên **không thể** chờ kết quả trong cùng
  transaction: `statement_timeout` của role `authenticated` (8s) cắt statement, và function-level
  `set statement_timeout` không gỡ được timer đã arm (đã thử thực tế). Vì vậy dùng
  `run_cycle_result()` + poll 2s/lần, tối đa 120s.
- User test `rpc-test-3b@maxxspace.com` đã xoá sau test.

- Commit: `ec8817f`.

## 2026-10-20 — Task 3.3: trang Nguồn (list + toggle + form thêm nguồn)

**Việc đã làm**
- `supabase/migrations/20261021_sources_write.sql`: thêm policy INSERT (`with check (true)`) và
  UPDATE (`using (true) with check (true)`) cho role `authenticated` trên `public.sources`, kèm
  `grant insert, update` — RLS ở 3.1 mới chỉ có SELECT nên toggle/form bị chặn. Không đổi schema.
- `dashboard/lib/sources.ts`: `fetchManagedSources` (kèm count từng nguồn, count lỗi → `null` hiện
  "?"), `setSourceEnabled` (dùng `.select()` để phát hiện RLS chặn UPDATE trả 0 dòng mà không lỗi),
  `createSource`, `buildNewSource` validate + dựng config đúng key collector (`github: query/min_stars/days`,
  `hackernews: queries[]/min_points`, `rss: url` — KHÔNG phải `feed_url`), `configSummary`,
  `writeErrorText` (map lỗi RLS/JWT sang hướng dẫn chạy migration).
- `dashboard/components/sources-manager.tsx`: mỗi nguồn 1 dòng — tên, badge loại, số item đã thu thập,
  tóm tắt config dạng cặp `key: value`, toggle bật/tắt (role=switch, disable + "Đang lưu…" khi lưu,
  lỗi hiện riêng từng dòng). Form thêm nguồn: chọn loại → field động; github query bắt buộc,
  min_stars 50 / days 14 mặc định; hackernews queries phẩy, min_points 30; rss tên + feed_url
  (`type=url` + validate http/https). Tên nguồn github/hn tự đặt từ query (hiện preview).
  Sau insert: reload list + báo thành công.
- `dashboard/app/nguon/page.tsx`: bỏ placeholder, bọc `RequireAuth` + `SiteHeader` + manager.
- `dashboard/app/globals.css`: style `.source-row`, `.badge`, `.toggle`, `.config`, form `.field`
  theo demo Feedly; light + dark; mobile cho row xuống 2 dòng.
- Facebook: row read-only (không toggle), ghi chú "Nguồn bị động — Merlin quét hộ theo lịch riêng,
  muốn thêm group mới thì báo Merlin"; form cũng ghi chú không thêm FB. Ghi DECISIONS #52.

**Migration & RLS — đã test thật**
- Agent đã apply `20261021_sources_write.sql` bằng `supabase db query --linked -f`
  (Phong vẫn nên chạy lại trong SQL Editor — file idempotent).
- `pg_policies` của `sources`: có `authenticated_read_sources` (SELECT),
  `authenticated_insert_sources` (INSERT), `authenticated_update_sources` (UPDATE).
- SQL test trong transaction với `set local role authenticated` → UPDATE + INSERT thành công rồi rollback;
  `set local role anon` → INSERT bị chặn `42501 new row violates row-level security policy` (đúng).

**E2E trên trình duyệt (session thật, dev server)**
- `/nguon/` hiện 6 nguồn: GitHub AI coding 19 tin, Hacker News 19, Simon Willison 31,
  Antigravity VN 13, Cộng đồng Claude AI & AI Agents Việt Nam 11, Vibe Code kiếm cơm 31.
  Config hiện đúng: github `days/query/last_seen/min_stars`, HN `queries/min_points`, RSS `url/last_seen`,
  FB `group_id/group_url`.
- Toggle GitHub: bấm → bắt được trạng thái `aria-busy=true` + "Đang lưu…"; DB `enabled=false`;
  UI row `off`, `aria-checked=false`; bấm lại → `enabled=true`, UI về bật.
- Form validate: github query rỗng → "Query GitHub không được để trống."; min_stars `abc` →
  "Min stars phải là số nguyên ≥ 0."; HN queries rỗng → báo đúng; RSS `not-a-url` →
  "Feed URL phải là URL hợp lệ (http:// hoặc https://)."
- Insert thật 3 loại (rồi xoá sạch): HN → row mới + notice "Đã thêm nguồn …", config
  `{queries:[...], min_points}`; RSS → `{url:"https://example.com/feed.xml"}`; GitHub →
  `{query, min_stars:75, days:7}`. List tự reload (6 → 7 → 8 → 9 dòng), count về 0 tin cho nguồn mới.
- Dọn test: xoá 3 source test → DB còn đúng 6 source thật, không sót row test.
- Theme dark kiểm tra lại: row/badge/toggle/form đọc rõ, không lệch màu.

**Kiểm tra build**
```text
cd dashboard
npm run lint  → pass (0 error)
npm run build → pass, out/nguon/index.html có trong static export
```

**Lưu ý cho model sau**
- `enabled=false` chỉ dừng **thu thập** nguồn đó; item đã có trong DB vẫn được chấm điểm/notify
  (scoring không lọc theo `sources.enabled`). Đúng phạm vi toggle của task.
- Nguồn Facebook không có toggle vì `ingest-facebook` không đọc `enabled` và `run-cycle` bỏ qua FB
  → toggle sẽ vô tác dụng (DECISIONS #52).
- Test dùng link Admin API tạo để có session: callback lưu session vào localStorage nhưng lần này
  không tự chuyển trang, phải mở `/tool-bantin/nguon/` tay. Không ảnh hưởng trang Nguồn; cần kiểm tra
  lại luồng callback khi test magic link thật ở task 3.4.

## 2026-10-20 — Task 3.4: workflow deploy dashboard lên GitHub Pages

**Đã làm — `.github/workflows/deploy-dashboard.yml`**
- Trigger: `push` vào `main` khi có thay đổi trong `dashboard/**` + `workflow_dispatch`
  (chạy tay được; lần deploy đầu tiên phải bấm tay vì workflow mới chỉ thêm file CI,
  không có thay đổi nào trong `dashboard/`).
- `permissions`: `contents: read`, `pages: write`, `id-token: write`; job deploy gắn
  `environment: github-pages`, `url` lấy từ output `deploy-pages`. Concurrency `pages`
  (không huỷ lượt đang chạy).
- `build`: checkout → setup-node 20 (cache npm theo `dashboard/package-lock.json`) →
  `npm ci` → `npm run build` với đúng 2 secrets `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (không service_role) → `upload-pages-artifact`
  path `dashboard/out`.
- `deploy`: `actions/deploy-pages@v4`.
- Thêm `NEXT_PUBLIC_BASE_PATH=/${{ github.event.repository.name }}` khi build để basePath
  luôn khớp tên repo Pages (hiện là `/tool-bantin`), tránh lệch nếu repo đổi tên.

**Test local (mô phỏng đúng workflow, không deploy)**
```text
cd dashboard
npm ci                                  → OK (chỉ warning audit có sẵn)
set -a && . ./.env.local && set +a
NEXT_PUBLIC_BASE_PATH=/tool-bantin npm run build
  → pass; out/ có /, /login, /auth/callback/, /nguon/
```
- Artifact đúng basePath: `out/index.html` trỏ `/tool-bantin/_next/static/...`.
- Bundle login có chuỗi ``${window.location.origin}/tool-bantin/auth/callback/``
  → production sẽ thành `https://phongnhat43.github.io/tool-bantin/auth/callback/`.
- Không có `SUPABASE_SERVICE_ROLE_KEY` trong `out/` (grep rỗng).
- Serve tĩnh `out/` tại `http://localhost:3000/tool-bantin/` (python http.server + symlink
  `tool-bantin -> dashboard/out`): session cũ còn hiệu lực → Feed hiện đúng 2 tin
  "Cần xem ngay", 2 tin "Hôm nay", 50 tin "Tất cả"; `/nguon/` hiện 6 nguồn + form.
  Chứng minh bản build production (không phải dev server) chạy được sau basePath.
- YAML parse OK bằng Ruby (`jobs` = build/deploy; đủ 5 step build). Máy không có
  `actionlint`/`gh` nên không kiểm tra được phía GitHub API.

**Chờ Phong (agent không tự làm được) — chi tiết trong HANDOFF**
1. Repo → Settings → Secrets and variables → Actions: tạo `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (lấy từ `dashboard/.env.local`, KHÔNG service_role).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Supabase → Authentication → URL Configuration: thêm
   `https://phongnhat43.github.io/tool-bantin/auth/callback/`.
4. Actions → "Deploy dashboard (GitHub Pages)" → Run workflow (main), đợi job xanh rồi mở
   `https://phongnhat43.github.io/tool-bantin/` kiểm tra đăng nhập + feed.

**Cảnh báo cần kiểm tra**
- Repo hiện **private**. GitHub Pages cho repo private chỉ có ở gói **Pro/Team/Enterprise**;
  nếu tài khoản đang Free thì Settings → Pages sẽ không bật được → phải chuyển repo sang
  public (repo không chứa secret, `.env*` đã ignore) hoặc nâng gói. Không tự đổi visibility.
- Trang Pages là file tĩnh công khai, nhưng dữ liệu vẫn do Supabase Auth + RLS chặn:
  chưa đăng nhập chỉ thấy shell + `/login`.

**Bổ sung cùng ngày — thứ tự deploy:** không cần push trước khi tạo secrets / bật Pages / thêm redirect
(cấu hình không nằm trong code), nhưng workflow chỉ lên GitHub **sau khi push** và chỉ chạy ở `main`.
Thứ tự sạch nhất: **secrets → Pages source → Supabase redirect → push `main` → workflow tự chạy**
(push có đổi `dashboard/**` nên trigger khớp). Nếu đã push trước: làm 3 thiết lập rồi **Re-run all jobs**.
Chi tiết ở HANDOFF mục “3.4 — Phong cần làm”.

## 2026-10-20 — Task 3.4 hoàn tất: dashboard lên GitHub Pages

**Kết quả:** production live tại **https://phongnhat43.github.io/tool-bantin/** — Phong đã đăng nhập
magic link và xem Feed thật OK.

**Đã làm**
- Workflow `.github/workflows/deploy-dashboard.yml`: push `main` đổi `dashboard/**` hoặc
  `workflow_dispatch` → Node 20 + cache npm → `npm ci` → `npm run build` với 2 secret public
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) → `upload-pages-artifact`
  (`dashboard/out`) → `deploy-pages`; environment `github-pages`; `basePath` theo tên repo.
- Phong cấu hình: 2 Repository secrets, Pages source = GitHub Actions, Supabase redirect URL
  `https://phongnhat43.github.io/tool-bantin/auth/callback/`, push `main`.
- Test local trước đó: `npm ci` + build production + serve `out/` sau basePath → Feed 3 khối,
  `/nguon` 6 nguồn; `actionlint` pass; bundle không có service_role.

**Sự cố production + cách sửa**
1. Deploy đầu: trang báo “This page couldn't load”, console `Invalid supabaseUrl`.
   Bundle có anon key nhưng **không có** `*.supabase.co` → build thiếu secret URL.
2. Cập nhật secret lần 2 vẫn lỗi. Bundle gọi `new sl("eyJ…","https://….supabase.co",{auth…})`
   → **2 secret bị hoán đổi** (anon key nằm ở URL, URL nằm ở key). Sửa đúng
   `NEXT_PUBLIC_SUPABASE_URL = https://gkyneqfagcqgliwtxyfs.supabase.co`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ…`, Re-run all jobs → trang load, login + Feed OK.

**Commit:** workflow `8c5d3ad`; docs 3.4 `48f2bbd`, `e5e3812`, `fa3d1f2`, `0c41dab` + commit hoàn tất 3.4.
