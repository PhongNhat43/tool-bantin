# Tool bản tin AI — Kiến trúc tổng thể

## Mục tiêu
Tool web thu thập tin tức AI coding từ nhiều nguồn, dashboard hiển thị gọn,
Telegram thông báo tin quan trọng. Làm web trước, app Flutter sau (dùng chung backend).

## Stack (đã chốt)
- Backend + DB + lịch chạy: **Supabase** (Postgres + Edge Functions TypeScript/Deno + pg_cron)
- Dashboard web: **Next.js (App Router)**, deploy Vercel (free, push là deploy)
- Thông báo: **Telegram Bot API**
- Một ngôn ngữ duy nhất: **TypeScript**

## Luồng dữ liệu
```
pg_cron (mỗi 2h)
  → từng collector (1 edge function / 1 loại nguồn)
  → normalize về schema chung (types.ts)
  → upsert vào bảng items — chống trùng bằng UNIQUE(source_id, external_id)
  → scoring (điểm cao mới notify)
  → Telegram notify
  → dashboard đọc trực tiếp từ bảng items

Nguồn Facebook: Merlin quét bằng lịch riêng → POST vào endpoint /ingest/facebook
  → đi chung luồng normalize như mọi nguồn khác.
```

## Quyết định đã chốt
- Không thuê VPS: Supabase free tier đủ cho tool cá nhân.
- Không làm FCM ở giai đoạn web: Telegram trước, push native để sau.
- Mỗi collector chạy độc lập, có checkpoint riêng (lưu `last_seen` trong `sources.config`).
- Không dùng AI (LLM) trong v1: lọc bằng từ khóa + điểm tương tác. Thêm LLM sau khi luồng chạy ổn.

## Cấu trúc thư mục
```
tool-bantin/
  AGENTS.md            # luật cho OpenCode, đọc mỗi session
  ARCHITECTURE.md      # file này
  TASKS.md             # checklist từng task theo thứ tự
  supabase/
    migrations/schema.sql
    functions/
      _shared/           # types.ts, normalize.ts, scoring.ts — dùng chung
      github-collector/
      reddit-collector/
      hackernews-collector/
      rss-collector/
      youtube-collector/
      ingest-facebook/   # endpoint nhận dữ liệu từ Merlin
      notify-telegram/
  dashboard/           # Next.js app (làm sau khi collectors chạy ổn)
```
