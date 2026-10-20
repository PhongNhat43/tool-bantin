# Dashboard — Bản tin AI

Dashboard Next.js 16 (App Router, TypeScript) đọc dữ liệu từ Supabase.

## Chạy local

```bash
cd dashboard
npm install
```

Tạo `dashboard/.env.local` (đã gitignore, **không commit**):

```bash
NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_URL trong .env root>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY trong .env root>
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào dashboard.

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Auth

- Magic link qua Supabase Auth, chỉ dùng email đã tạo trong **Authentication → Users**.
- Proxy (`proxy.ts`, Next.js 16 đổi tên từ middleware) chặn mọi route khi chưa có session.
- `/login` gửi magic link; `/auth/callback` đổi code lấy session.
- Redirect URL cần có `http://localhost:3000/auth/callback` trong **Authentication → URL Configuration**.
- RLS: chạy `supabase/migrations/20261020_dashboard_rls.sql`; policy SELECT cho role `authenticated`, single user.

## Cấu trúc

```text
app/
  page.tsx              # 10 item mới nhất (Server Component, tạm)
  login/page.tsx        # form magic link
  auth/callback/route.ts
components/logout-button.tsx
lib/supabase/client.ts  # browser client
lib/supabase/server.ts  # server client (cookies)
proxy.ts                # chặn route chưa đăng nhập
```
