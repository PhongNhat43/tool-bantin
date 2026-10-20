-- ============================================================================
-- 20261021_sources_write.sql
-- Cho dashboard (static export, chỉ có anon key + session user) bật/tắt nguồn
-- và thêm nguồn mới ở trang /nguon.
--
-- Chạy trong Supabase Dashboard → SQL Editor, dán TOÀN BỘ file rồi Run.
-- An toàn khi chạy lại (drop policy if exists + grant idempotent).
--
-- Bối cảnh: migration 20261020_dashboard_rls.sql (task 3.1) mới chỉ tạo policy
-- SELECT cho `authenticated`, nên UPDATE (toggle) và INSERT (form thêm nguồn)
-- bị RLS chặn. File này bổ sung đúng 2 policy đó, không đổi schema.
--
-- Single-user project: policy `true` giống SELECT ở 3.1. `anon` KHÔNG được cấp
-- INSERT/UPDATE (chỉ `authenticated`), nên ai chưa đăng nhập vẫn không ghi được.
-- ============================================================================

-- Phòng trường hợp chưa bật RLS (3.1 đã bật; câu này idempotent).
alter table public.sources enable row level security;

-- 1) Thêm nguồn mới từ form /nguon.
drop policy if exists "authenticated_insert_sources" on public.sources;
create policy "authenticated_insert_sources"
  on public.sources
  for insert
  to authenticated
  with check (true);

-- 2) Bật/tắt nguồn. UPDATE cần cả USING (chọn dòng được sửa) và WITH CHECK
--    (dòng sau khi sửa vẫn hợp lệ).
drop policy if exists "authenticated_update_sources" on public.sources;
create policy "authenticated_update_sources"
  on public.sources
  for update
  to authenticated
  using (true)
  with check (true);

-- RLS chỉ lọc row; vẫn cần quyền ở mức bảng.
grant insert, update on table public.sources to authenticated;

-- ============================================================================
-- VERIFY (chạy sau khi Run)
-- ============================================================================
-- -- 1. Policy đã có đủ SELECT + INSERT + UPDATE cho authenticated:
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'sources'
-- order by policyname;
-- -- kỳ vọng: authenticated_read_sources (SELECT),
-- --          authenticated_insert_sources (INSERT),
-- --          authenticated_update_sources (UPDATE)
--
-- -- 2. authenticated có quyền ghi, anon thì không:
-- select has_table_privilege('authenticated', 'public.sources', 'insert') as auth_insert,
--        has_table_privilege('authenticated', 'public.sources', 'update') as auth_update,
--        has_table_privilege('anon',          'public.sources', 'insert') as anon_insert,
--        has_table_privilege('anon',          'public.sources', 'update') as anon_update;
-- -- kỳ vọng: true, true, false, false
-- ============================================================================
