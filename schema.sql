-- Tool bản tin AI — schema v1
-- Chạy 1 lần trong Supabase SQL Editor.

create table if not exists sources (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,            -- github | reddit | youtube | rss | hackernews | facebook
  name        text not null,            -- tên hiển thị, vd "r/ClaudeAI"
  config      jsonb not null default '{}', -- cấu hình riêng: { "subreddit": "ClaudeAI", "last_seen": "2026-10-19T00:00:00Z" }
  keywords    text[] not null default '{}', -- từ khóa lọc riêng của nguồn
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references sources(id) on delete cascade,
  external_id  text not null,           -- id của nền tảng gốc (post id, repo id...)
  title        text not null,
  content      text,                    -- tóm tắt / nội dung ngắn
  url          text not null,
  author       text,
  published_at timestamptz,
  engagement   jsonb not null default '{}', -- vd { "stars": 120, "comments": 15 }
  score        integer not null default 0,  -- điểm sau scoring
  created_at   timestamptz not null default now(),
  unique (source_id, external_id)       -- chống trùng: cùng 1 nguồn không lưu 2 lần
);

create index if not exists items_published_idx on items (published_at desc);
create index if not exists items_score_idx on items (score desc);

create table if not exists notification_log (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  channel    text not null,             -- telegram
  sent_at    timestamptz not null default now(),
  unique (item_id, channel)             -- mỗi tin chỉ gửi 1 lần / 1 kênh
);
