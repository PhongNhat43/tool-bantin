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
