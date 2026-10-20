# Checklist thực hiện — làm theo đúng thứ tự, từng task một

## Phase 0 — Setup (làm đầu tiên)
- [x] 0.1 Tạo project Supabase mới, lấy SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY, cho vào `.env` (không commit) (19/10, làm trên dashboard)
- [x] 0.2 Chạy `supabase/migrations/schema.sql` trong SQL Editor, verify 3 bảng được tạo (19/10, verify: sources/items/notification_log)
- [x] 0.3 Khởi tạo git repo, viết `.gitignore` (có `.env*`), commit đầu tiên, push lên GitHub (19/10, 74a018b — repo private PhongNhat43/tool-bantin)
- [x] 0.4 Tạo Telegram bot via @BotFather, lấy token, lưu vào Supabase secrets (19/10, làm trên dashboard)
  - Tiêu chí xong: repo GitHub sạch, không lộ secret, DB có 3 bảng trống

## Phase 1 — Collectors (mỗi cái xong phải chạy thử + show log)
- [x] 1.1 `_shared/`: types.ts (ItemInput chung), normalize.ts, keywords.ts (bộ từ khóa T1 theo AGENTS.md mục 6) — xong trước, các collector dùng chung (19/10, 6253a0c + patch 1.1b)
- [x] 1.2 `github-collector`: search repos AI coding agents/MCP/automation, tạo ≤ 14 ngày, stars > 50, có README + commit gần đây, checkpoint `last_seen` (19/10, 6253a0c + patch 1.2b)
- [ ] 1.3 `reddit-collector`: đọc `/r/<sub>/new.json` với sub = ClaudeAI, AI_Agents (lấy từ bảng `sources`) — **DỜI xuống cuối Phase 1** (chờ phê duyệt API Reddit 2–4 tuần, xem DECISIONS #10)
- [x] 1.4 `hackernews-collector`: Algolia API, query "Claude Code"/"AI coding", points ≥ 30 (19/10, b63e13a)
- [x] 1.5 `rss-collector`: generic, đọc RSS từ URL trong `sources.config` (Simon Willison, Anthropic news) (19/10, e0510af — kèm `_shared/xml.ts`; **Anthropic KHÔNG có feed chính thức, đã verify 15 URL + sitemap → chỉ seed Simon Willison**)
- [x] 1.5b Tách `github-collector` + `hackernews-collector` thành `collector.ts` (logic, import không tác dụng phụ) + `index.ts` (entrypoint ~30 dòng) theo đúng pattern rss-collector — đóng cảnh báo #33 (19/10, da64117 github + 241dd4f hackernews)
- [x] 1.6 `ingest-facebook`: endpoint POST nhận JSON từ Merlin (3 groups: Vibe Code kiếm cơm, Antigravity VN, Claude AI & AI Agents VN) → normalize → upsert (19/10, dba3082 — auth header `x-ingest-secret` + tắt `verify_jwt`; 3 group đã seed; test `--once` + HTTP 200/400/401/405)
- [ ] 1.7 `youtube-collector`: ĐỂ V2, không làm (không tính là task Phase 1)
  - Tiêu chí xong mỗi collector: chạy 1 lệnh, log rõ fetch/new/dedup, dữ liệu vào đúng bảng `items`

## Phase 2 — Lọc + Thông báo (final plan chốt 19/10/2026, chi tiết đầy đủ trong AGENTS.md mục 6)
- [x] 2.0 `run-cycle`: orchestrator — đọc `sources` enabled → gọi từng collector (try/catch riêng từng source) → scoring → notify; pg_cron mỗi 2h gọi run-cycle qua pg_net, auth bằng CRON_SECRET (20/10, 4be1a82 — 3 collector chạy độc lập, 117 item backfill đủ breakdown, digest 4 tin gửi thật, instant test 90 điểm xác nhận rồi xoá, deploy + sai secret → 401)
- [x] 2.0b Fix test RSS flaky: lưu fixture thật `rss-collector/testdata/feed.xml`, mock fetch cho feed Simon (không gọi mạng RSS), chạy 10 lần → 10/10 pass (20/10 — không đổi logic collector)
- [x] 2.1 `scoring.ts` trong `_shared/`: đúng công thức AGENTS.md mục 6; breakdown lưu vào engagement.score_breakdown, score lưu tổng (19/10, 79485ce — 11 test offline)
- [x] 2.1b Chốt `supabase/config.toml` tối thiểu (`[functions.*] verify_jwt = false`), xoá `.bak`, deploy **không flag** (20/10 — sai secret vào ingest-facebook + run-cycle đều trả JSON 401 của code, chứng minh verify_jwt=false có hiệu lực từ config)
- [x] 2.2 `notify-telegram`: ≥70 gửi ngay 1 tin/item (preview bật); 40–69 gom 1 digest/kỳ dạng bullet (tắt preview); ghi notification_log chống gửi lặp; trigger báo ngay: nhóm A + bài <24h, cross-source ≥2/24h, breaking + engagement hot (19/10, 5e3e9de — lib `_shared/notify.ts`, 9 test offline + gửi thật vào group "Bản tin AI")
- [x] 2.3 Bật extensions pg_cron + pg_net + Vault; job `run-cycle-2h` mỗi 2h vào phút 0 (20/10 — migration `20261020_run_cycle_cron.sql`, secret Vault placeholder `__CRON_SECRET__`, wrapper `public.trigger_run_cycle()`; **chờ Phong chạy SQL Editor + verify `cron.job` / `cron.job_run_details` / `net._http_response`**)
  - Sau khi Phong chạy: `select * from cron.job;` thấy job `run-cycle-2h`; gọi tay `select public.trigger_run_cycle();`; check `cron.job_run_details` không lỗi + HTTP 200 trong `net._http_response`.
  - Tiêu chí xong: có tin mới vào DB mỗi 2h, Telegram nhận được tin điểm cao

## Phase 3 — Dashboard web (Next.js) — thiết kế final chốt 19/10/2026, xem demo tại dashboard-demo.html v2
- [x] 3.1 Scaffold Next.js 16 (App Router, TypeScript, không src-dir) trong `dashboard/`; Supabase Auth magic link 1 user; proxy chặn route chưa đăng nhập; RLS SELECT cho `authenticated`; trang chủ tạm đọc 10 item mới nhất bằng Server Component (20/10 — `npm run dev`/`build`/`lint` pass; `/` chưa login → `/login`; magic link thật gửi qua hộp thư test → callback → thấy 10 item; logout OK; RLS đã apply; redirect URL localhost đã thêm)
- [x] 3.1b Chuyển dashboard sang **static export** cho GitHub Pages: `output: export` + `trailingSlash` + `basePath=/tool-bantin`; bỏ `proxy.ts`/Server Component/Route Handler → `RequireAuth` client, `/login` + `/auth/callback` client (PKCE), trang chủ fetch client; bỏ `@supabase/ssr`. Build ra `out/`, serve `out/` sau basePath → chưa login bị đẩy `/login/`, magic link → session → 10 item, logout → chặn lại (20/10, d0b5ab0)
- [x] 3.2 Trang Feed đúng demo: 3 khối (Cần xem ngay ≥70 / Hôm nay 40–69 / Tất cả + search + filter nguồn), hàng ngang kiểu Feedly (ô score vuông bo góc trái + tiêu đề/meta phải), bấm expand hiện mô tả + breakdown điểm + link gốc; theme light mặc định + toggle dark; nút "Chạy ngay" gọi run-cycle qua RPC (20/10, ec8817f)
  - ⚠️ Cần Phong chạy `supabase/migrations/20261021_rpc_grant.sql` trong SQL Editor (agent đã apply để test E2E, chạy lại vô hại) — nếu chưa có, nút "Chạy ngay" báo "chưa có RPC" còn Feed vẫn chạy bình thường
- [x] 3.3 Trang Nguồn: danh sách + toggle bật/tắt + form thêm nguồn (field động theo loại) — đúng yêu cầu "thêm tay nguồn mới" (20/10, 7c8f888 — migration `20261021_sources_write.sql` policy INSERT/UPDATE; form github/hn/rss validate client; facebook chỉ hiển thị; **chờ Phong chạy lại migration trong SQL Editor**, agent đã apply nên toggle/form chạy được)
- [ ] 3.4 Deploy Vercel + env production (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`), thêm redirect URL Vercel vào Supabase Auth, kiểm tra đăng nhập + RLS trên production
  - ⚠️ Đã đổi hướng ở 3.1b: deploy **GitHub Pages** (static export) thay Vercel — chờ Phong chốt lại nội dung 3.4 (bật Pages, thêm redirect URL `https://phongnhat43.github.io/tool-bantin/auth/callback/`)
  - Tiêu chí xong Phase 3: mở web là thấy tin, đúng phong cách Feedly tối giản trong demo, không card nặng/shadow/chart thừa; production đăng nhập được

## Phase 4 — Khai thác & tương tác (AI layer) — ý tưởng chốt 19/10/2026, làm sau khi Phase 1–3 vận hành trơn
Mục đích: biến thông tin thành hành động — không để tin nằm chết trong dashboard.
- [ ] 4.1 Bookmark: nút lưu tin trên dashboard + Telegram; bảng mới `saved_items` (item_id, note, created_at)
- [ ] 4.2 Thảo luận với AI: nút "Thảo luận" trên mỗi tin → khung chat trên dashboard, AI đọc sẵn nội dung tin để bàn cùng (tóm tắt sâu, phân tích áp dụng, mặt trái); sau mở rộng sang Telegram (reply vào tin nhắn). Dùng model rẻ (Gemini Flash).
- [ ] 4.3 Briefing AI: tối Chủ nhật hàng tuần tự tổng hợp tin hot thành bản "tuần này có gì" (xu hướng + điểm đáng chú ý), gửi Telegram — khác digest ở chỗ diễn giải chứ không liệt kê
- [ ] 4.4 Gợi ý theo mục tiêu (v2 của Phase 4): gắn nhãn tin liên quan tới mục tiêu của user (Flutter, app tiếng Nhật...), làm sau khi có dữ liệu dùng thật
  - Chi phí ước tính < $1/tháng (model rẻ, tần suất thấp). Tiêu chí xong: bookmark lưu được, chat thảo luận trả lời đúng ngữ cảnh tin, briefing Chủ nhật gửi đúng hẹn

## Ghi chú
- Task nào cũng phải chạy thử được trước khi đánh dấu xong.
- Vướng quá 3 lần sửa cùng hướng → dừng, báo lại.
