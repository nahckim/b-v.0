alter table public.captures
  add column if not exists barry_note text,
  add column if not exists recommended_action text,
  add column if not exists processed_at timestamptz,
  add column if not exists slack_posted_at timestamptz,
  add column if not exists slack_error text;
