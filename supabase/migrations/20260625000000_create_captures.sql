create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  raw_content text not null,
  source_device text not null,
  source_channel text not null,
  source_agent text not null default 'human',
  processed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
