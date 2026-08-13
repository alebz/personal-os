-- Import de settlements de Clip: cada settlement crea su COSTO de comisión con la fee REAL de la API (no la
-- tasa configurada, que queda solo de respaldo). Idempotente por settlement_report_id. Heartbeat visible si
-- falla, como el de Poster. CLIP es la cuenta del negocio: NO hay depósito a otro lado, solo la comisión que baja CLIP.
alter table publico_costos add column if not exists clip_settlement_id text;
-- Un settlement entra UNA vez por scope. Las comisiones MANUALES (clip_settlement_id null) conviven (NULLs distintos).
create unique index if not exists publico_costos_clip_settlement_uq on publico_costos (scope, clip_settlement_id);

create table if not exists publico_clip_sync (
  id              text primary key default 'default',
  last_success_at timestamptz,
  last_import_from date,
  last_import_to   date,
  last_error      text,
  updated_at      timestamptz not null default now()
);
insert into publico_clip_sync (id) values ('default') on conflict (id) do nothing;
