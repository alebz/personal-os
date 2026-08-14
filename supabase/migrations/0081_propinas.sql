-- Propinas de tarjeta (jaladas de Clip /payments, campo `tip` por transacción). La propina NO es venta: es
-- dinero del personal que CAE a CLIP como pasivo. Poster registra la comida aparte, así que el ingreso ya está
-- limpio de propina (verificado). El problema que resuelve esto: la propina cae físicamente a CLIP pero el
-- flujo de contenedores solo acreditaba la comida → CLIP salía subestimado y la propina aparecía como
-- "sobrante" al cuadrar. Ahora la propina entra a CLIP como flujo, y se reparte con eventos aparte.

-- Acumulado por día (idempotente por scope,date). Lo llena el import de Clip; NO se teclea a mano.
create table if not exists publico_propinas (
  scope      text not null default 'publico',
  date       date not null,
  month      text not null,
  monto      numeric not null default 0,     -- suma de tips de tarjeta del día (pesos)
  n_tx       int not null default 0,         -- transacciones con propina ese día
  source     text not null default 'clip',
  updated_at timestamptz not null default now(),
  primary key (scope, date)
);

-- Repartos al personal: bajan el pasivo (pendiente) Y sacan el dinero del contenedor. Reversibles (borrar).
create table if not exists publico_propina_repartos (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  fecha      date not null,
  amount     numeric not null,
  contenedor text not null default 'clip',   -- de qué contenedor sale (por defecto CLIP, donde caen las de tarjeta)
  nota       text,
  created_at timestamptz not null default now()
);
create index if not exists publico_propina_repartos_fecha on publico_propina_repartos (fecha);

-- Heartbeat del import de propinas (mismo patrón que Poster/settlements): visible si falla.
create table if not exists publico_propina_sync (
  id              text primary key default 'default',
  last_success_at timestamptz,
  last_import_from date,
  last_import_to   date,
  last_error      text,
  updated_at      timestamptz not null default now()
);
insert into publico_propina_sync (id) values ('default') on conflict (id) do nothing;
