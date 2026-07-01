create table resonances (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  type       text not null,
  created_at timestamptz not null default now()
);
