-- 0006_finance.sql
-- Personal finance tracker tables. All amounts in MXN.

-- Recurring fixed expenses: subscriptions, rent, etc.
create table finance_commitments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  amount     numeric(12,2) not null check (amount > 0),
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Vacation savings envelopes (e.g. Q4 2026, Q2 2027)
create table finance_envelopes (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  target     numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- All financial movements: income + expenses
create table finance_movements (
  id            uuid primary key default gen_random_uuid(),
  month         text not null,       -- 'YYYY-MM', denormalised for fast monthly queries
  date          date not null default current_date,
  description   text not null,
  amount        numeric(12,2) not null check (amount > 0),
  flow          text not null check (flow in ('in', 'out')),
  category      text not null check (
    category in ('nomina', 'freelance', 'gasto_fijo', 'gasto_extra', 'vacaciones')
  ),
  commitment_id uuid references finance_commitments(id) on delete set null,
  envelope_id   uuid references finance_envelopes(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index finance_movements_month_idx    on finance_movements (month);
create index finance_movements_envelope_idx on finance_movements (envelope_id)
  where envelope_id is not null;

-- Balance reconciliation (append-only; latest row = current state)
create table finance_balance (
  id          uuid primary key default gen_random_uuid(),
  tarjeta     numeric(12,2) not null default 0,
  efectivo    numeric(12,2) not null default 0,
  caja_fuerte numeric(12,2) not null default 0,
  updated_at  timestamptz not null default now()
);

-- Seed vacation envelopes (targets editable from the UI)
insert into finance_envelopes (label, target) values
  ('Q4 2026', 30000),
  ('Q2 2027', 30000);
