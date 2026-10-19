# DECISIONS — nhật ký quyết định thiết kế

> Append-only: mỗi quyết định thêm 1 dòng mới ở cuối, KHÔNG sửa/xóa dòng cũ.
> Khi đổi ý: thêm dòng mới ghi rõ "thay thế quyết định #N" + lý do.

| # | Ngày | Quyết định | Lý do | Người quyết |
|---|------|-----------|-------|-------------|
| 1 | 19/10 | Nền tảng Supabase thay vì VPS tự quản | Free tier đủ dùng, khỏi quản trị server | Phong |
| 2 | 19/10 | Nguồn v1: 3 group FB + Reddit + GitHub + HN + 2 blog RSS; YouTube để v2 | YouTube quota thấp, video dài loãng — nội dung hay sẽ lọt qua Reddit/FB | Merlin đề xuất, Phong chốt |
| 3 | 19/10 | Tiêu chí lọc 3 tầng + công thức điểm (chủ đề 40 + tương tác 30 + độ mới 20 + cross-source 10); ≥70 báo ngay, 40–69 digest, <40 chỉ lưu DB | Tách lọc thô (từ khóa) khỏi chấm tinh (điểm số) | Phong chốt |
| 4 | 19/10 | Fix false positive "không bán"/"đánh giá" bằng NEGATIVE_EXCEPTIONS trong keywords.ts, không để sang scoring | Sửa tận gốc rẻ hơn chữa ở tầng sau | Merlin |
| 5 | 19/10 | Exception chỉ miễn đúng cụm từ, phần còn lại của câu vẫn chấm bình thường | "Đánh giá tool mới, giá siêu rẻ" vẫn phải phạt vì "giá siêu rẻ" là bán hàng | Merlin |
| 6 | 19/10 | Edge case "không bán giá cao" bỏ qua, không thêm logic | Hiếm gặp, thêm logic là over-engineering | Merlin |
| 7 | 19/10 | Thêm run-cycle orchestrator (thay vì pg_cron gọi từng collector rời rạc) | 1 nguồn chết không sập cả kỳ quét | Merlin |
| 8 | 19/10 | Dashboard phong cách Feedly/RSS reader tối giản, theme light mặc định + toggle dark | Phong chọn sau khi xem demo v2 | Phong |
| 9 | 19/10 | Auth dashboard: magic link 1 user | Nhẹ, free, khỏi nhớ password | Merlin |
| 10 | 19/10 | Task 1.3 reddit-collector dời xuống cuối Phase 1 | Reddit cần phê duyệt API (chờ 2–4 tuần) | Merlin |
| 11 | 19/10 | HN collector không ghi checkpoint khi gặp 429 | Tránh mất vĩnh viễn dữ liệu chưa lấy được | LLM đề xuất, Merlin duyệt |
| 12 | 19/10 | Giữ dữ liệu test trong DB (33 items) | Task 2.1 scoring cần dữ liệu thật để kiểm chứng | Merlin |
| 13 | 19/10 | Áp dụng cơ chế bàn giao (HANDOFF/WORKLOG/DECISIONS + mục 7 AGENTS.md) | Đổi model vẫn làm tiếp được, không mất ngữ cảnh | Phong yêu cầu, Merlin thiết kế |
| 14 | 19/10 | Collector giữ `Deno.serve` vô điều kiện, thêm cờ `--once` để chạy local 1 lần; KHÔNG dùng `import.meta.main` | Supabase Edge Runtime nạp module bằng bootstrap riêng nên `import.meta.main` không đáng tin (có thể khiến function không bao giờ serve) | Agent đề xuất |
| 15 | 19/10 | HN collector gộp trùng **giữa các query** bằng Map theo `objectID` TRƯỚC khi upsert | "Claude Code" và "AI coding" trả story chung (18 thô → 14 unique); gộp trước để log dedup đúng và khỏi upsert thừa | Agent đề xuất |
| 16 | 19/10 | HN story không có `url` ngoài → trỏ về `https://news.ycombinator.com/item?id=<objectID>` | Ask/Launch HN không có link ngoài nhưng `items.url` là NOT NULL, vẫn cần URL hợp lệ (2 story Launch HN đã dùng nhánh này) | Phong (spec Task 1.4) |
| 17 | 19/10 | Test nhánh lỗi collector bằng mock `globalThis.fetch` (offline, tất định) thay vì cố ép lỗi thật | Rate limit GitHub/HN reset mỗi 60s gây race, ép lỗi thật không tái lập được; mock chặn đúng domain API còn call Supabase vẫn đi mạng thật | Agent đề xuất |
| 18 | 19/10 | Khi gặp 429/rate-limit: dừng êm và **KHÔNG ghi checkpoint** | Nếu ghi checkpoint lúc lỗi sẽ nhảy qua vĩnh viễn khoảng dữ liệu chưa lấy được | Agent đề xuất |
| 19 | 19/10 | Backfill một lần cho WORKLOG/DECISIONS (Task 0.2 → 1.4); từ sau chỉ append | Hai file sinh ra sau khi việc đã chạy nên thiếu mục; cần đúng một lần đồng bộ rồi giữ kỷ luật append | Phong yêu cầu |
| 20 | 19/10 | **Làm rõ #7:** `run-cycle` là **1 edge function orchestrator**; pg_cron mỗi 2h gọi run-cycle qua **pg_net**, auth bằng `CRON_SECRET` trong secrets. KHÔNG để pg_cron gọi từng collector rời rạc. | Trước đó TASKS.md 2.3 ghi "pg_cron chạy lần lượt các collectors", mâu thuẫn với #7. Nay thống nhất: pg_cron chỉ có 1 job duy nhất gọi orchestrator, orchestrator tự try/catch từng source | Phong (đã ghi vào AGENTS.md mục 6) |
| 21 | 19/10 | Chốt chi tiết scoring vào AGENTS.md mục 6: engagement nội suy tuyến tính theo ngưỡng qua/hot (HN 30→5, 100→30; GitHub 50→5, 500→30; Reddit 30→5, 200→30; FB 15→5, 80→30; RSS cố định 15), recency theo mốc 6/12/24/48h, cross-source +10 khi ≥2 nguồn độc lập trong 24h. Breakdown lưu `engagement.score_breakdown`, tổng ở cột `score` — **không sửa schema** | Cần con số cụ thể để Task 2.1 code được, không phải đoán | Phong ủy quyền Merlin quyết |
| 22 | 19/10 | AGENTS.md mục 7 (quy trình làm việc & bàn giao) chính thức có hiệu lực: đầu session đọc AGENTS→TASKS→HANDOFF→DECISIONS; 1 task = 1 commit; append WORKLOG/DECISIONS; cập nhật HANDOFF; push khi được yêu cầu | Đổi model vẫn làm tiếp được, không mất ngữ cảnh | Phong |
