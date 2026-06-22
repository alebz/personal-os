-- 0020_finance_monthly_state.sql
-- Stores the full monthly state for the Uptown panel tracker as JSONB.
-- Mirrors the original localStorage schema keyed by 'YYYY-MM'.

create table if not exists finance_monthly_state (
  month       text primary key,            -- 'YYYY-MM'
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table finance_monthly_state enable row level security;
alter table finance_monthly_state force row level security;
