create table uptown_reconciliations (
  id             uuid        primary key default gen_random_uuid(),
  month          text        not null,
  date           timestamptz not null default now(),
  saldo_esperado numeric     not null,
  cuenta         numeric     not null,
  efectivo       numeric     not null,
  total_real     numeric     not null,
  diferencia     numeric     not null,
  created_at     timestamptz not null default now()
);

create index on uptown_reconciliations (month, created_at desc);
