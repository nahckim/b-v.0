alter table public.captures
  add column if not exists archived_at timestamptz;

create index if not exists captures_active_created_at_idx
  on public.captures (created_at desc)
  where archived_at is null;
