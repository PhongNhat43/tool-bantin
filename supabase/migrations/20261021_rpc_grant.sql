-- ============================================================================
-- 20261021_rpc_grant.sql
-- Cho dashboard (static export, chỉ có anon key + session user) bấm "Chạy ngay".
--
-- Chạy trong Supabase Dashboard → SQL Editor, dán TOÀN BỘ file rồi Run.
-- An toàn khi chạy lại (create or replace + grant idempotent).
--
-- Bối cảnh: public.trigger_run_cycle() (task 2.3) dùng net.http_post nên là
-- lời gọi BẤT ĐỒNG BỘ — nó trả về ngay, còn kết quả HTTP nằm trong
-- net._http_response vài giây sau. Vì vậy ngoài dòng grant (bắt buộc), file
-- này thêm 1 hàm CHỈ ĐỌC để dashboard lấy được tóm tắt kỳ chạy vừa xong.
-- Browser không bao giờ thấy CRON_SECRET (secret nằm trong Vault, đọc bởi
-- function security definer).
-- ============================================================================

-- 1) Cho user đã đăng nhập gọi được wrapper (browser không thấy secret).
--    ⚠️ Supabase cấp EXECUTE mặc định cho CẢ anon khi tạo function trong schema
--    public (`alter default privileges`), và `revoke ... from public` KHÔNG gỡ
--    quyền cấp trực tiếp đó → phải revoke riêng anon, nếu không ai có anon key
--    cũng gọi được run-cycle (tốn quota + spam Telegram).
revoke all on function public.trigger_run_cycle() from public, anon;
grant execute on function public.trigger_run_cycle() to authenticated;

-- 2) Đọc kết quả HTTP gần nhất của run-cycle (chỉ đọc, không ghi).
--    net._http_response chỉ postgres đọc được → SECURITY DEFINER + search_path=''.
create or replace function public.run_cycle_result()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status_code', r.status_code,
    'body', case
              when r.content is null or r.content = '' then null
              when btrim(r.content) like '{%' then r.content::jsonb
              else null
            end,
    'created', r.created
  )
  from net._http_response r
  order by r.created desc
  limit 1;
$$;

revoke all on function public.run_cycle_result() from public, anon;
grant execute on function public.run_cycle_result() to authenticated;

-- ============================================================================
-- VERIFY (chạy sau khi Run)
-- ============================================================================
-- -- 1. authenticated có quyền gọi 2 hàm:
-- select has_function_privilege('authenticated', 'public.trigger_run_cycle()', 'execute') as can_trigger,
--        has_function_privilege('authenticated', 'public.run_cycle_result()', 'execute')   as can_read;
-- -- kỳ vọng: can_trigger = true, can_read = true
--
-- -- 2. anon KHÔNG được gọi:
-- select has_function_privilege('anon', 'public.trigger_run_cycle()', 'execute') as anon_can_trigger;
-- -- kỳ vọng: false
--
-- -- 3. Gọi thử bằng role authenticated:
-- set role authenticated;
-- select public.run_cycle_result();          -- id + status 200 của kỳ gần nhất
-- select public.trigger_run_cycle();         -- trả về ngay (void)
-- reset role;
-- ============================================================================
