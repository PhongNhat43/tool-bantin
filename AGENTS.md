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
- Không nhồi nhét: dashboard sau này tuân thủ tiêu chí "ít nhưng sắc" đã chốt trong ARCHITECTURE.md.

## 6. Tiêu chí lọc đã chốt (19/10/2026 — không tự ý đổi)
- T1 từ khóa có trọng số: nhóm A "token/API miễn phí" (token free, api miễn phí, key free, giveaway, tặng key, voucher, credits) ưu tiên cao nhất; nhóm B workflow & bí quyết; nhóm C tool/sản phẩm mới; nhóm D tin tức. Từ khóa phủ định (ib, inbox, giá, bán, slot, buff, mua chung) trừ điểm nặng.
- T2 ngưỡng theo nguồn: Facebook reacts+comments ≥ 15 qua / ≥ 80 hot (bài có link github/drive/repo cộng điểm); Reddit upvotes ≥ 30 và ratio ≥ 0.75; GitHub stars > 50, tạo ≤ 14 ngày, có README, commit ≤ 30 ngày; Hacker News points ≥ 30 qua / ≥ 100 hot; RSS theo allowlist.
- T3 công thức điểm: chủ đề (0–40) + tương tác chuẩn hóa (0–30) + độ mới (0–20) + cross-source bonus (0–10). ≥ 70 báo ngay Telegram, 40–69 vào digest, < 40 chỉ lưu DB.
- Chống trùng: cùng URL (chuẩn hóa, bỏ tracking params) hoặc cùng external_id → gộp 1 tin, cộng điểm cross-source.
