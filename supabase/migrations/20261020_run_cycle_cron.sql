-- ============================================================================
-- 20261020_run_cycle_cron.sql
-- Bật pg_cron + pg_net + Vault, tạo wrapper gọi run-cycle mỗi 2h.
--
-- ⚠️ FILE NÀY CHỨA PLACEHOLDER `__CRON_SECRET__`.
--    KHÔNG commit secret thật. Trước khi chạy, Phong thay placeholder bằng
--    giá trị CRON_SECRET thật (lấy từ .env local / Supabase secrets).
--
-- Cách chạy: xem hướng dẫn ở CUỐI file (SQL Editor, chạy từng khối).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- KHỐI 1 — Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Vault đã bật mặc định trên Supabase; tên extension là `supabase_vault`
-- (schema `vault`). Nếu project đã có thì câu này no-op.
create extension if not exists supabase_vault with schema vault;

-- ----------------------------------------------------------------------------
-- KHỐI 2 — Lưu CRON_SECRET vào Vault
-- ----------------------------------------------------------------------------
-- Chạy MỘT LẦN. Nếu đã có secret tên `cron_secret`, dùng vault.update_secret
-- (xem hướng dẫn cuối file) thay vì chạy lại dòng này.
select vault.create_secret(
  '__CRON_SECRET__',
  'cron_secret',
  'CRON_SECRET cho pg_cron gọi run-cycle'
);

-- ----------------------------------------------------------------------------
-- KHỐI 3 — Wrapper function
-- Job chỉ gọi function này; command của job KHÔNG chứa secret.
-- ----------------------------------------------------------------------------
create or replace function public.trigger_run_cycle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s text;
begin
  select decrypted_secret into s
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if s is null or s = '' then
    raise exception 'Chưa có vault secret tên cron_secret';
  end if;

  if s = '__CRON_SECRET__' then
    raise exception 'cron_secret vẫn là placeholder __CRON_SECRET__ — thay bằng giá trị thật';
  end if;

  perform net.http_post(
    url := 'https://gkyneqfagcqgliwtxyfs.supabase.co/functions/v1/run-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', s
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

-- Chỉ postgres/cron được gọi; không mở cho anon/authenticated.
revoke all on function public.trigger_run_cycle() from public;
grant execute on function public.trigger_run_cycle() to postgres;

-- ----------------------------------------------------------------------------
-- KHỐI 4 — Lịch chạy mỗi 2h (phút 0)
-- ----------------------------------------------------------------------------
select cron.schedule(
  'run-cycle-2h',
  '0 */2 * * *',
  $$select public.trigger_run_cycle()$$
);

-- ============================================================================
-- HƯỚNG DẪN CHO PHONG — Supabase Dashboard → SQL Editor
-- ============================================================================
-- 0) CRON_SECRET đã được set trên Supabase Edge Functions secrets từ task 2.0
--    (tên đã xác nhận bằng `supabase secrets list`). Giá trị thật nằm trong
--    file `.env` local (KHÔNG commit, KHÔNG dán vào chat).
--    Nếu muốn tạo mới:
--      supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
--    rồi cập nhật lại giá trị trong .env và placeholder bên dưới.
--
-- 1) Dán RIÊNG KHỐI 1 (extensions) và Run.
--    Nếu báo thiếu quyền hoặc extension không có → dừng, báo lại cho agent.
--
-- 2) Thay `__CRON_SECRET__` trong KHỐI 2 bằng giá trị thật, dán KHỐI 2 và Run.
--    - Nếu chưa từng tạo secret: dùng `vault.create_secret(...)`.
--    - Nếu đã có secret `cron_secret` (chạy lại file), dùng:
--        select vault.update_secret(
--          (select id from vault.secrets where name = 'cron_secret'),
--          '<CRON_SECRET_THAT>'
--        );
--
-- 3) Dán KHỐI 3 (function) và Run.
--
-- 4) Dán KHỐI 4 (schedule) và Run.
--
-- 5) Verify:
--    select jobid, jobname, schedule, command, active
--    from cron.job where jobname = 'run-cycle-2h';
--
--    -- gọi tay 1 lần
--    select public.trigger_run_cycle();
--
--    -- cron wrapper chạy OK (không lỗi SQL)
--    select jobid, status, return_message, start_time
--    from cron.job_run_details
--    order by start_time desc limit 5;
--
--    -- HTTP thật do pg_net gửi (status 200 = run-cycle OK)
--    select id, status_code, content, created
--    from net._http_response
--    order by created desc limit 5;
--
-- 6) Kiểm tra command của job không chứa secret:
--    select command from cron.job where jobname = 'run-cycle-2h';
--    -- phải là: select public.trigger_run_cycle()
-- ============================================================================
