alter table public.captures
  add column if not exists raw_content text,
  add column if not exists source_device text,
  add column if not exists source_channel text,
  add column if not exists source_agent text default 'human',
  add column if not exists processed boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
