create table uptown_cortes (
  id          uuid        primary key default gen_random_uuid(),
  month       text        not null,
  date        timestamptz not null default now(),
  sistema     numeric     not null,
  real        numeric     not null,
  diferencia  numeric     not null,
  concepto    text,
  created_at  timestamptz not null default now()
);

create index on uptown_cortes (month, created_at desc);
