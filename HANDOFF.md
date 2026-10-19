# HANDOFF — trạng thái hiện tại của project

> "Bản giao ca" cho model mới: đầu mỗi session đọc theo thứ tự
> AGENTS.md (luật) → TASKS.md (việc) → HANDOFF.md (trạng thái) → DECISIONS.md (quyết định đã chốt).

_Cập nhật lần cuối: 19/10/2026 (sau Task 1.4 + backfill docs)_

## Đang ở đâu
- **Phase 0: xong** — Supabase project, schema 3 bảng, git + GitHub, Telegram bot + group nhận tin
- **Phase 1:**
  - [x] 1.1 `_shared/` (types, keywords, normalize) + patch 1.1b (NEGATIVE_EXCEPTIONS)
  - [x] 1.2 github-collector + patch 1.2b (GITHUB_TOKEN, move schema.sql)
  - [x] 1.4 hackernews-collector
  - [ ] 1.3 reddit-collector — DỜI CUỐI Phase 1 (chờ quyết định phê duyệt API Reddit)
  - [ ] 1.5 rss-collector — TASK TIẾP THEO
  - [ ] 1.6 ingest-facebook — endpoint nhận JSON do Merlin bắn vào (spec riêng)
- **Phase 2:** final plan đã chốt (AGENTS.md mục 6), chưa ra prompt chi tiết
- **Phase 3:** thiết kế dashboard đã chốt (demo dashboard-demo.html v2, light mặc định, Feedly tối giản), implement sau Phase 2

## Dữ liệu & repo hiện tại
- DB: 33 items (github 19 + hackernews 14), cột score = 0 (chưa chấm — việc của Task 2.1)
- GitHub: đã push, main sạch, working tree sạch

## Quyết định đang treo
- **Reddit:** giữ ở v1 (nộp đơn phê duyệt API ngay tuần này, chờ 2–4 tuần) hay đẩy sang v2? → Đề xuất: nộp đơn ngay, code để cuối Phase 1

## Lưu ý cho model mới
- Đọc DECISIONS.md trước khi đề xuất bất kỳ thay đổi thiết kế nào — không đề xuất lại thứ đã chốt
- Mọi ngưỡng và công thức trong AGENTS.md mục 6 là final — không tự ý đổi
- WORKLOG.md và DECISIONS.md là append-only — không sửa/xóa dòng cũ
- **Runtime:** Deno 2.9.7 đã cài qua brew. Chạy 1 collector local bằng
  `deno run --allow-net --allow-env --allow-read index.ts --once` (thêm `--once`, nếu không nó sẽ chạy `Deno.serve` và treo).
- **Push GitHub:** repo **private**. Shell của agent **không có credential** nên không tự push được — phải nhờ Phong push tay.
- ⚠️ **AGENTS.md hiện CHƯA có mục 7** (mới có 6 mục) dù cơ chế bàn giao đã được ghi ở DECISIONS #13 — chờ Phong bổ sung.
- Phân vân thì xem `DECISIONS.md` #14–#18 cho các quyết định kỹ thuật của Phase 1 (entrypoint, gộp trùng HN, URL fallback, cách test nhánh lỗi).
