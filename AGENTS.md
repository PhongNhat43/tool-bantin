# AGENTS.md — Luật làm việc cho project tool-bantin

File này OpenCode đọc mỗi session. Mọi code sinh ra phải tuân thủ.

## 1. Stack
- Supabase: Postgres + Edge Functions (TypeScript/Deno). Lịch chạy: pg_cron.
- Dashboard: Next.js App Router (làm sau). Thông báo: Telegram Bot API.
- Chỉ dùng TypeScript. Không thêm framework/lib mới khi chưa hỏi.

## 2. Kiến trúc bắt buộc
- Mỗi loại nguồn = 1 edge function collector riêng trong `supabase/functions/`.
- Code dùng chung (types, normalize, scoring) để trong `supabase/functions/_shared/`, không copy-paste giữa các collector.
- Mỗi collector: đọc `sources.config` lấy checkpoint (`last_seen`) → chỉ fetch phần mới hơn → normalize → upsert.
- Chống trùng ở DB: `UNIQUE(source_id, external_id)`. Không tự chế cơ chế khác.

## 3. Quy ước
- Tên bảng/cột: snake_case. Tên file function: kebab-case.
- Secrets (SUPABASE_URL, SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN...) chỉ nằm trong `.env` / Supabase secrets. **Không bao giờ commit secret, không hardcode.**
- `.gitignore` phải có `.env*` ngay từ đầu.

## 4. Quy trình làm việc (bắt buộc)
- Làm đúng theo `TASKS.md`, từng task một, theo thứ tự.
- Mỗi task xong phải **chạy thử được và show log/output** trước khi sang task tiếp theo.
- Collector nào cũng phải chạy độc lập được bằng 1 lệnh, log rõ: số item fetch được, số item mới, số item bị loại trùng.
- Không tự ý thêm bảng/cột ngoài `schema.sql`. Muốn đổi schema thì hỏi trước.
- Gặp lỗi thì sửa tối đa 3 lần theo cùng 1 hướng; quá 3 lần thì dừng, báo lại để đổi hướng.

## 5. Cấm
- Không bịa API endpoint, không đoán cấu trúc response — phải kiểm tra thật (docs hoặc chạy thử).
- Không viết code "cho có": mọi collector phải xử lý lỗi mạng, retry tối đa 3 lần với backoff.
- Không nhồi nhét: dashboard tuân thủ thiết kế final chốt 19/10/2026 (xem dashboard-demo.html v2) — phong cách Feedly/RSS reader tối giản: list + divider, không card nặng, không shadow mạnh, không chart, không animation thừa; theme light mặc định + toggle dark.

## 6. Tiêu chí lọc đã chốt (19/10/2026 — không tự ý đổi)
- T1 từ khóa có trọng số: nhóm A "token/API miễn phí" (token free, api miễn phí, key free, giveaway, tặng key, voucher, credits) ưu tiên cao nhất; nhóm B workflow & bí quyết; nhóm C tool/sản phẩm mới; nhóm D tin tức. Từ khóa phủ định (ib, inbox, giá, bán, slot, buff, mua chung) trừ điểm nặng.
- T2 ngưỡng theo nguồn: Facebook reacts+comments ≥ 15 qua / ≥ 80 hot (bài có link github/drive/repo cộng điểm); Reddit upvotes ≥ 30 và ratio ≥ 0.75; GitHub stars > 50, tạo ≤ 14 ngày, có README, commit ≤ 30 ngày; Hacker News points ≥ 30 qua / ≥ 100 hot; RSS theo allowlist.
- T3 công thức điểm: chủ đề (0–40) + tương tác chuẩn hóa (0–30) + độ mới (0–20) + cross-source bonus (0–10). ≥ 70 báo ngay Telegram, 40–69 vào digest, < 40 chỉ lưu DB.
- Chống trùng: cùng URL (chuẩn hóa, bỏ tracking params) hoặc cùng external_id → gộp 1 tin, cộng điểm cross-source.

### Chi tiết scoring (chốt 19/10/2026 — Phong ủy quyền Merlin quyết định)
- Engagement (0–30): ngưỡng qua → 5 điểm, ngưỡng hot → 30 điểm, giữa nội suy tuyến tính. Facebook (reactions+comments): <15 loại, 15→5, 80→30. Reddit: upvotes <30 hoặc ratio <0.75 loại, 30→5, 200→30. GitHub: 50→5, 500→30 (≤50 đã loại ở query). HN: points <30 loại, 30→5, 100→30. RSS (allowlist): cố định 15.
- Recency (0–20): <6h → 20; <12h → 15; <24h → 10; <48h → 5; còn lại → 0.
- Cross-source (0–10): cùng URL chuẩn hóa hoặc title tương đồng, xuất hiện ở ≥2 nguồn độc lập trong 24h → +10.
- Breakdown lưu vào `engagement.score_breakdown`, cột `score` lưu tổng điểm. Không sửa schema.
- Notify: ≥70 gửi ngay, 1 tin nhắn/item, để preview bật. 40–69 gom thành 1 digest/kỳ dạng bullet, tắt preview. Trigger báo ngay bất chấp điểm: từ khóa nhóm A + bài <24h; cross-source ≥2 nguồn/24h; breaking + engagement mức hot.
- Orchestrator `run-cycle`: mỗi source chạy trong try/catch riêng — source nào chết thì log, các source khác vẫn chạy, không sập cả kỳ. pg_cron mỗi 2h gọi run-cycle qua pg_net, auth bằng CRON_SECRET trong secrets.

## 7. Quy trình làm việc & bàn giao (bắt buộc — để đổi model vẫn làm tiếp được)
1. Đầu mỗi session đọc theo thứ tự: AGENTS.md → TASKS.md → HANDOFF.md → DECISIONS.md.
2. Làm task theo đúng thứ tự TASKS.md, không nhảy cóc, không tự ý thêm task.
3. Mỗi task phải đạt "tiêu chí xong" và show output/log cho chủ project xem.
4. Sau khi task được duyệt:
   - Đánh dấu `[x]` trong TASKS.md, kèm ngày và commit hash (vd: `- [x] 1.2 github-collector (19/10, 6253a0c)`)
   - Append 1 mục vào WORKLOG.md (ngày, task, việc đã làm, kết quả test, commit)
   - Nếu có quyết định thiết kế mới: thêm dòng vào DECISIONS.md (không sửa dòng cũ)
   - Cập nhật HANDOFF.md: trạng thái hiện tại, task tiếp theo, quyết định đang treo
5. 1 task = 1 commit, message rõ ràng. Không commit secret. Push khi được yêu cầu.
6. WORKLOG.md và DECISIONS.md là append-only — không sửa/xóa dòng cũ. Đổi ý thì thêm dòng mới ghi rõ thay thế quyết định #mấy.
7. Khi không chắc về yêu cầu: hỏi, không tự đoán. Khi phát hiện blind spot: báo + đề xuất hướng sửa, không tự ý đổi (đúng như đã làm ở patch 1.1b).
