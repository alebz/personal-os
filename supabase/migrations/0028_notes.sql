create table if not exists notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null default '',
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy "full access" on notes
  using (true)
  with check (true);
