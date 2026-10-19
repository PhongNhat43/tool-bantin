# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 19/10/2026 (sau khi AGENTS.md mục 7 — quy trình bàn giao — được ban hành)_

## Đang ở đâu
- **Phase 0: xong** — Supabase project, schema 3 bảng, git + GitHub, Telegram bot + group nhận tin
- **Phase 1:**
  - [x] 1.1 `_shared/` (types, keywords, normalize) + patch 1.1b (NEGATIVE_EXCEPTIONS)
  - [x] 1.2 github-collector + patch 1.2b (GITHUB_TOKEN, move schema.sql)
  - [x] 1.4 hackernews-collector
  - [ ] 1.3 reddit-collector — DỜI CUỐI Phase 1 (chờ quyết định phê duyệt API Reddit)
  - [ ] 1.5 rss-collector — TASK TIẾP THEO
  - [ ] 1.6 ingest-facebook — endpoint nhận JSON do Merlin bắn vào (spec riêng)
- **Phase 2:** final plan đã chốt 19/10 — chi tiết scoring đầy đủ + orchestrator `run-cycle` nằm ở **AGENTS.md mục 6** (phần "Chi tiết scoring"); việc chia nhỏ ở TASKS.md 2.0–2.3. Chưa code.
- **Phase 3:** thiết kế dashboard đã chốt (light mặc định, Feedly/RSS tối giản) — chi tiết ở AGENTS.md mục 5. ✅ Demo đã có trong repo: **`dashboard-demo.html`** (v2, 404 dòng, light + toggle dark) — Phase 3 phải đối chiếu file này, không tự đoán (TASKS.md 3.2).

## Dữ liệu & repo hiện tại
- DB: 33 items (github 19 + hackernews 14), cột score = 0 (chưa chấm — việc của Task 2.1)
- GitHub: `origin/main` = `b63e13a`; có **2 commit local chưa push** (`ef2b0a5`, `f473758` docs). Working tree: đang có fix thứ tự AGENTS.md + `dashboard-demo.html` chưa commit.

## Quyết định đang treo
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay tuần này, chờ 2–4 tuần) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1
- **dashboard-demo.html:** Phong sẽ bổ sung file demo vào repo (giữ nguyên tham chiếu trong AGENTS.md/TASKS.md, không gỡ). Phase 3 chưa bắt đầu nên chưa gấp.
- **Push:** có **2 commit local chưa push** (`ef2b0a5`, `f473758`) + commit fix kế tiếp — agent không có credential nên phải nhờ Phong push tay.

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất bất kỳ thay đổi thiết kế nào — không đề xuất lại thứ đã chốt
- Mọi ngưỡng và công thức trong AGENTS.md mục 6 là final — không tự ý đổi
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xóa dòng cũ
- **Runtime:** Deno 2.9.7 đã cài qua brew. Chạy 1 collector local bằng
  `deno run --allow-net --allow-env --allow-read index.ts --once` (thêm `--once`, nếu không nó sẽ chạy `Deno.serve` và treo).
- **Push GitHub:** repo **private**. Shell của agent **không có credential** nên không tự push được — phải nhờ Phong push tay.
- ✅ **AGENTS.md đã có mục 7** (quy trình làm việc & bàn giao) — bắt buộc tuân thủ: 1 task = 1 commit, append WORKLOG/DECISIONS, cập nhật HANDOFF, push khi được yêu cầu.
- ✅ **Thứ tự mục AGENTS.md đã đúng:** 1 → 7 liên tục (mục 7 đã chuyển xuống cuối, sau mục 6).
- Phân vân thì xem `DECISIONS.md` #14–#22: #14–#18 là quyết định kỹ thuật Phase 1, #20 gỡ vênh orchestrator, #21 chốt chi tiết scoring, #22 mục 7 có hiệu lực.
