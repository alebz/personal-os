-- Income items (recurring income templates)
create table if not exists finance_income_items (
  id          text        primary key default gen_random_uuid()::text,
  nombre      text        not null,
  monto       numeric     not null,
  metodo      text        not null default 'efectivo',
  sort_order  int         not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);
alter table finance_income_items enable row level security;
alter table finance_income_items force row level security;

-- Seed default income items (4× nómina semanal $8,000)
insert into finance_income_items (id, nombre, monto, metodo, sort_order) values
  ('n1', 'Nómina semana 1', 8000, 'efectivo', 0),
  ('n2', 'Nómina semana 2', 8000, 'efectivo', 1),
  ('n3', 'Nómina semana 3', 8000, 'efectivo', 2),
  ('n4', 'Nómina semana 4', 8000, 'efectivo', 3)
on conflict (id) do nothing;

-- Add metodo to finance_commitments
alter table finance_commitments add column if not exists metodo text default 'cargo';

-- Add vacation-tracking fields to finance_envelopes
alter table finance_envelopes add column if not exists sem_ahorro numeric default 600;
alter table finance_envelopes add column if not exists fecha      text;
alter table finance_envelopes add column if not exists pausado    boolean default false;

-- Update existing envelopes to $600/week if present
update finance_envelopes set sem_ahorro = 600 where sem_ahorro is null;

-- Add metodo to finance_movements (for tracking payment method per movement)
alter table finance_movements add column if not exists metodo text;
