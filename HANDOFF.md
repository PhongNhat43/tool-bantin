# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 19/10/2026 (sau Task 1.5 — rss-collector + _shared/xml.ts)_

## Đang ở đâu
- **Phase 0: xong** — Supabase project, schema 3 bảng, git + GitHub, Telegram bot + group nhận tin
- **Phase 1:**
  - [x] 1.1 `_shared/` (types, keywords, normalize) + patch 1.1b (NEGATIVE_EXCEPTIONS)
  - [x] 1.2 github-collector + patch 1.2b (GITHUB_TOKEN, move schema.sql)
  - [x] 1.4 hackernews-collector
  - [x] 1.5 rss-collector + `_shared/xml.ts` (parser tự viết — Deno không có DOMParser) — commit `e0510af`
  - [ ] 1.3 reddit-collector — DỜI CUỐI Phase 1 (chờ quyết định phê duyệt API Reddit)
  - [ ] 1.6 ingest-facebook — endpoint nhận JSON do Merlin bắn vào (spec riêng) — **TASK TIẾP THEO**
- **Phase 2:** final plan đã chốt 19/10 — chi tiết scoring đầy đủ + orchestrator `run-cycle` nằm ở **AGENTS.md mục 6** (phần "Chi tiết scoring"); việc chia nhỏ ở TASKS.md 2.0–2.3. Chưa code.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo đã có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).
- **Phase 4 (mới, Phong thêm 19/10):** bookmark, thảo luận với AI, briefing tuần, gợi ý theo mục tiêu — TASKS.md Phase 4. Ý tưởng, làm sau Phase 1–3.

## Dữ liệu & repo hiện tại
- DB: **63 items** (github 19 + hackernews 14 + rss 30), mọi `score = 0` (chấm điểm là việc Task 2.1)
- `sources`: 3 row đều enabled — github, hackernews, rss/Simon Willison (`config.url = https://simonwillison.net/atom/everything/`)
- **Test có trong repo** (từ 19/10, DECISIONS #30): `supabase/functions/_shared/xml_test.ts` + `supabase/functions/rss-collector/index_test.ts`. Chạy: `deno test --allow-net --allow-env --allow-read supabase/functions/` → 6 passed (**đã chạy 10 lần liên tiếp: 10/10 pass**). Test nhánh lỗi **ghi thật vào DB** (tạo rồi xoá 6 source `[TEST] ...`), cần `SUPABASE_SERVICE_ROLE_KEY`.
- **rss-collector tách 2 file** (DECISIONS #32): `collector.ts` = toàn bộ logic (import KHÔNG có tác dụng phụ), `index.ts` = entrypoint 30 dòng (`--once` → chạy 1 lần, ngược lại → `Deno.serve`). Test import `collector.ts`.
- GitHub: `origin/main` = `b63e13a`; có **7 commit local chưa push** (`ef2b0a5`, `f473758`, `a6cfb54`, `e0510af` code 1.5, `2f71e37` docs 1.5, `2d26892` test, + commit fix flaky này). Working tree sạch sau khi commit.

## Quyết định đang treo
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay tuần này, chờ 2–4 tuần) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1
- **Anthropic news:** không có feed chính thức (DECISIONS #28). Muốn lấy tin Anthropic thì phải scrape HTML `/news` hoặc dùng nguồn thứ ba — Phong quyết khi nào cần.
- **Push:** 6 commit local chưa push — agent không có credential nên phải nhờ Phong push tay.

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất bất kỳ thay đổi thiết kế nào — không đề xuất lại thứ đã chốt
- Mọi ngưỡng và công thức trong AGENTS.md mục 6 là final — không tự ý đổi
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xóa dòng cũ
- **Runtime:** Deno 2.9.7 đã cài qua brew. Chạy 1 collector local bằng
  `deno run --allow-net --allow-env --allow-read index.ts --once` (thêm `--once`, nếu không nó sẽ chạy `Deno.serve` và treo). Cờ phải đặt SAU tên file.
- **Deno KHÔNG có `DOMParser`/`XMLSerializer`/`Document`** (không phải API của Deno, không có kể cả với `--unstable*`) — đừng thử lại. Cần parse XML/RSS thì dùng `supabase/functions/_shared/xml.ts` (đã có sẵn, 35 test pass). Xem DECISIONS #23.
- ⚠️ **Đừng viết test import thẳng `index.ts` của collector.** `Deno.serve` bind `127.0.0.1:8000`, và health-check của editor gọi `GET /health` vào đó → handler chạy thêm 1 lượt collector **song song** với lượt của test → test flaky kiểu "số lần gọi mạng nhân đôi". rss-collector đã tách logic ra `collector.ts` để test import file đó. `github-collector`/`hackernews-collector` **chưa tách** — muốn viết test cho chúng thì tách trước. Xem DECISIONS #32/#33.
- **Push GitHub:** repo **private**. Shell của agent **không có credential** nên không tự push được — phải nhờ Phong push tay.
- ✅ **AGENTS.md đã có mục 7** (quy trình làm việc & bàn giao) — bắt buộc tuân thủ: 1 task = 1 commit, append WORKLOG/DECISIONS, cập nhật HANDOFF, push khi được yêu cầu.
- ✅ **Thứ tự mục AGENTS.md đã đúng:** 1 → 7 liên tục (mục 7 đã chuyển xuống cuối, sau mục 6).
- ⚠️ **TASKS.md đã từng bị ghi đè mất dấu `[x]` 2 lần** (19/10). Từ giờ Phong sửa TRÊN bản hiện tại, không copy từ bản cũ (DECISIONS #31) → model không phải re-apply nữa. Nếu vẫn thấy mất dấu thì re-apply cho 0.1–0.4, 1.1, 1.2, 1.4, 1.5 + ghi chú (1.3 DỜI, 1.6 TASK TIẾP THEO, 1.7 ĐỂ V2).
- Phân vân thì xem `DECISIONS.md` #14–#33: #14–#18, #23–#28 là quyết định kỹ thuật collector; #20 gỡ vênh orchestrator; #21 chốt chi tiết scoring; #22 mục 7 có hiệu lực; #29 tổng kết Task 1.5; #30 test vào repo; #31 cách sửa TASKS.md; #32 tách `collector.ts` vì bẫy cổng 8000; #33 cảnh báo 2 collector còn lại.
