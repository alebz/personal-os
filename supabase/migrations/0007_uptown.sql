-- 0007_uptown.sql
-- Property management tracker for "Uptown", León, Guanajuato.
-- All amounts in MXN.

-- Monthly rent payments per renter
create table uptown_rents (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,         -- 'YYYY-MM'
  renter     text not null,         -- renter ID key (e.g. 'arko')
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  paid       boolean not null default false,
  created_at timestamptz not null default now(),
  unique(month, renter)
);

-- Monthly fixed expense records (CFE, SAPAL, Internet, Martha, etc.)
create table uptown_fixed_expenses (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,
  category   text not null,         -- expense key (e.g. 'cfe', 'fondo')
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  paid       boolean not null default false,
  created_at timestamptz not null default now(),
  unique(month, category)
);

create index uptown_fixed_expenses_fondo_idx
  on uptown_fixed_expenses (category, paid)
  where category = 'fondo';

-- Weekly payroll (nómina semanal) — 4 weeks per month
create table uptown_nomina (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,
  week_num   int not null check (week_num between 1 and 4),
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  paid       boolean not null default false,
  created_at timestamptz not null default now(),
  unique(month, week_num)
);

-- Free-form extra income entries
create table uptown_extra_income (
  id          uuid primary key default gen_random_uuid(),
  month       text not null,
  description text not null,
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now()
);

-- Free-form extra expense entries
create table uptown_extra_expenses (
  id          uuid primary key default gen_random_uuid(),
  month       text not null,
  description text not null,
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now()
);

-- Balance snapshot per month (cuenta bancaria + efectivo + starting balance)
create table uptown_balance (
  id               uuid primary key default gen_random_uuid(),
  month            text not null unique,
  starting_balance numeric(12,2) not null default 0,
  cuenta_bancaria  numeric(12,2) not null default 0,
  efectivo         numeric(12,2) not null default 0,
  updated_at       timestamptz not null default now()
);
