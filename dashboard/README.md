# Dashboard — Bản tin AI

Dashboard Next.js 16 (App Router, TypeScript) đọc dữ liệu từ Supabase.

**Static export** (`output: "export"`) — deploy lên GitHub Pages, không có server.
Vì vậy auth + đọc DB chạy hoàn toàn ở client (Supabase JS + RLS), không dùng
`proxy.ts` / Server Component / Route Handler.

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
npm run dev     # http://localhost:3000/tool-bantin/
npm run build   # sinh ra out/
npm run lint
```

Xem bản build tĩnh (basePath `/tool-bantin` nên phải serve đúng tiền tố):

```bash
mkdir -p /tmp/bantin-preview
ln -sfn "$PWD/out" /tmp/bantin-preview/tool-bantin
npx serve -l 3000 /tmp/bantin-preview
# → http://localhost:3000/tool-bantin/
```

Muốn serve ở gốc domain (không basePath): `NEXT_PUBLIC_BASE_PATH="" npm run build`
rồi `npx serve out`.

## Auth

- Magic link qua Supabase Auth (PKCE), chỉ dùng email đã tạo trong
  **Authentication → Users**. Project đã **tắt** "Allow new users to sign up" —
  giữ nguyên để người ngoài không tự đăng ký.
- `RequireAuth` (client) chặn trang private: chưa có session → `/login`.
- `/login` gửi magic link (`emailRedirectTo = origin + basePath + /auth/callback/`).
- `/auth/callback` đổi `?code=` lấy session; fallback nhận token trong hash
  (link do admin tạo, không có code_challenge).
- Session lưu trong `localStorage` của trình duyệt (không có cookie server).
- RLS: `supabase/migrations/20261020_dashboard_rls.sql` — policy SELECT cho role
  `authenticated`. Anon key vẫn đọc được 0 row.
- Nút **Chạy ngay** (header) gọi `rpc("trigger_run_cycle")` → `trigger_run_cycle()` đọc
  `CRON_SECRET` từ Vault ngay trên server (browser **không** thấy secret), rồi poll
  `rpc("run_cycle_result")` 2s/lần (≤120s) để lấy tóm tắt kỳ chạy. Cả 2 RPC cần
  migration `supabase/migrations/20261021_rpc_grant.sql` (grant `authenticated`,
  revoke `anon`) — chạy file đó 1 lần trong SQL Editor.
- Redirect URL cần có trong **Authentication → URL Configuration**:
  - `http://localhost:3000/tool-bantin/auth/callback/` (local, đã hoạt động)
  - `https://phongnhat43.github.io/tool-bantin/auth/callback/` (GitHub Pages)

## Cấu trúc

```text
app/
  layout.tsx                # metadata + script set data-theme trước khi paint
  page.tsx                  # Feed: 3 khối (Cần xem ngay / Hôm nay / Tất cả)
  nguon/page.tsx            # placeholder — trang Nguồn ở task 3.3
  login/page.tsx            # form magic link (client)
  auth/callback/page.tsx    # đổi code/token lấy session (client)
  globals.css               # CSS variables light/dark + layout kiểu Feedly
components/
  require-auth.tsx          # chặn route private ở client
  site-header.tsx           # header sticky: tab, theme, Chạy ngay, Đăng xuất
  feed-sections.tsx         # 3 khối tin + search/lọc nguồn/Tải thêm
  item-row.tsx              # 1 dòng tin + expand (breakdown, engagement, link gốc)
  run-now-button.tsx        # RPC trigger + poll run_cycle_result
  theme-toggle.tsx          # light/dark, lưu localStorage
  logout-button.tsx
lib/
  config.ts                 # BASE_PATH
  format.ts                 # thời gian tương đối, tier điểm, breakdown, nhãn nguồn
  items.ts                  # query đọc-only cho 3 khối + sources + kết quả run-cycle
  supabase/client.ts        # browser client (PKCE, detectSessionInUrl)
next.config.ts              # output: export, trailingSlash, basePath
```

GitHub Pages: publish thư mục `out/` (workflow CI hoặc đẩy tay), repo Settings →
Pages → source = GitHub Actions / branch. `out/` đã gitignore.
