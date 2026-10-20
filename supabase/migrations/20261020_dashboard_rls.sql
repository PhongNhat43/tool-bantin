-- Tool bản tin AI — RLS cho dashboard (single user)
-- Chạy MỘT LẦN trong Supabase SQL Editor.
--
-- Dashboard dùng Supabase Auth (magic link) với anon key. Sau khi đăng nhập,
-- role là `authenticated`. Chỉ role này được SELECT; anon bị RLS chặn.
-- Collector/run-cycle dùng service_role nên vẫn bypass RLS bình thường.
--
-- Hướng dẫn cho Phong:
--   (a) Chạy toàn bộ file này trong SQL Editor.
--   (b) Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
--       thêm http://localhost:3000/auth/callback
--       (sau này thêm https://<domain-vercel>/auth/callback)
--   (c) Authentication → Users → Add user → nhập email của Phong nếu chưa có.
--       Magic link sẽ gửi tới email đó.

alter table public.items enable row level security;
alter table public.sources enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists "authenticated_read_items" on public.items;
create policy "authenticated_read_items"
  on public.items
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated_read_sources" on public.sources;
create policy "authenticated_read_sources"
  on public.sources
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated_read_notification_log" on public.notification_log;
create policy "authenticated_read_notification_log"
  on public.notification_log
  for select
  to authenticated
  using (true);

-- RLS chỉ lọc row; vẫn cần quyền SELECT ở mức bảng.
grant select on table public.items to authenticated;
grant select on table public.sources to authenticated;
grant select on table public.notification_log to authenticated;
