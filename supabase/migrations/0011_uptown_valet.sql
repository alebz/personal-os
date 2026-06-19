-- 0011_uptown_valet.sql
-- Valet management: per-week tenant payments and monthly config.

create table if not exists uptown_valet_config (
  month         text primary key,
  num_weeks     integer not null default 4 check (num_weeks between 1 and 5),
  week1_date    date,
  nu_balance    numeric(12,2) not null default 0,
  provider_paid jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists uptown_valet_payments (
  id          uuid primary key default gen_random_uuid(),
  month       text not null,
  week_num    integer not null check (week_num between 1 and 5),
  tenant_id   text not null,
  status      text not null default 'pending' check (status in ('pending', 'paid', 'advance')),
  updated_at  timestamptz not null default now(),
  unique (month, week_num, tenant_id)
);

create index if not exists uptown_valet_payments_month_idx
  on uptown_valet_payments (month);
