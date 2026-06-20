create table if not exists journal_entries (
  id          uuid        primary key default gen_random_uuid(),
  entry_date  date        not null unique,
  content     text,
  mood        text        check (mood in ('excelente', 'bien', 'regular', 'bajo', 'caotico')),
  summary     text,
  insights    jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists journal_entries_date_idx
  on journal_entries (entry_date desc);

alter table journal_entries enable row level security;
alter table journal_entries force row level security;
