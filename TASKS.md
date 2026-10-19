# Checklist thực hiện — làm theo đúng thứ tự, từng task một

## Phase 0 — Setup (làm đầu tiên)
- [ ] 0.1 Tạo project Supabase mới, lấy SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY, cho vào `.env` (không commit)
- [ ] 0.2 Chạy `supabase/migrations/schema.sql` trong SQL Editor, verify 3 bảng được tạo
- [ ] 0.3 Khởi tạo git repo, viết `.gitignore` (có `.env*`), commit đầu tiên, push lên GitHub
- [ ] 0.4 Tạo Telegram bot via @BotFather, lấy token, lưu vào Supabase secrets
  - Tiêu chí xong: repo GitHub sạch, không lộ secret, DB có 3 bảng trống

## Phase 1 — Collectors (mỗi cái xong phải chạy thử + show log)
- [ ] 1.1 `_shared/`: types.ts (ItemInput chung), normalize.ts, keywords.ts (bộ từ khóa T1 theo AGENTS.md mục 6) — xong trước, các collector dùng chung
- [ ] 1.2 `github-collector`: search repos AI coding agents/MCP/automation, tạo ≤ 14 ngày, stars > 50, có README + commit gần đây, checkpoint `last_seen`
- [ ] 1.3 `reddit-collector`: đọc `/r/<sub>/new.json` với sub = ClaudeAI, AI_Agents (lấy từ bảng `sources`)
- [ ] 1.4 `hackernews-collector`: Algolia API, query "Claude Code"/"AI coding", points ≥ 30
- [ ] 1.5 `rss-collector`: generic, đọc RSS từ URL trong `sources.config` (Simon Willison, Anthropic news)
- [ ] 1.6 `ingest-facebook`: endpoint POST nhận JSON từ Merlin (3 groups: Vibe Code kiếm cơm, Antigravity VN, Claude AI & AI Agents VN) → normalize → upsert
- [ ] 1.7 `youtube-collector`: ĐỂ V2, không làm
  - Tiêu chí xong mỗi collector: chạy 1 lệnh, log rõ fetch/new/dedup, dữ liệu vào đúng bảng `items`

## Phase 2 — Lọc + Thông báo
- [ ] 2.1 `scoring.ts`: đúng công thức đã chốt trong AGENTS.md mục 6 (chủ đề 0–40 + tương tác 0–30 + độ mới 0–20 + cross-source 0–10; ≥70 báo ngay, 40–69 digest, <40 chỉ lưu DB)
- [ ] 2.2 `notify-telegram`: gửi item điểm cao, ghi `notification_log` để không gửi lặp
- [ ] 2.3 Dựng pg_cron: mỗi 2h chạy lần lượt các collectors → notify
  - Tiêu chí xong: có tin mới vào DB mỗi 2h, Telegram nhận được tin điểm cao

## Phase 3 — Dashboard web (Next.js)
- [ ] 3.1 Khởi tạo Next.js app trong `dashboard/`, đọc Supabase, deploy Vercel
- [ ] 3.2 Trang feed: danh sách items, filter theo nguồn/từ khóa, progressive disclosure (tổng quan trước, chi tiết sau)
- [ ] 3.3 Trang quản lý sources: thêm/xóa/bật-tắt nguồn, sửa keywords — đúng yêu cầu "thêm tay nguồn mới"
  - Tiêu chí xong: mở web là thấy tin, đúng tiêu chí "ít nhưng sắc"

## Ghi chú
- Task nào cũng phải chạy thử được trước khi đánh dấu xong.
- Vướng quá 3 lần sửa cùng hướng → dừng, báo lại.
