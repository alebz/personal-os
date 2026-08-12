-- FASE 2 · Gastos previstos de Público. Modelo HÍBRIDO: la RECURRENCIA es una DEFINICIÓN (no se pre-crean N
-- meses), y las ocurrencias se DERIVAN por fecha (como finance_commitments). Materialización rodante e
-- indefinida hasta que archives — archivar detiene la generación futura SIN borrar el historial.
-- El checkbox de "pagado" crea un publico_costos REAL (pega en contenedor + utilidad); se guarda la ref para
-- poder revertirlo al desmarcar. La tarjeta de crédito NO vive aquí: se deriva de finance_card_charges
-- (attribution='publico') para no duplicar captura (ver decisión de diseño, punto 10).

create table if not exists publico_previstos (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'publico',
  concepto    text not null,
  categoria   text not null check (categoria in ('insumo','nomina','gasto_fijo','reinversion','renta_condonada')),
  origin      text check (origin in ('clip','caja_chica','caja_pos')),   -- contenedor; null = "sin caja". Precargado del default de la categoría, editable.
  amount      numeric(12,2) not null check (amount > 0),
  frecuencia  text not null check (frecuencia in ('semanal','quincenal','mensual','bimestral')),
  anchor_date date not null,          -- primer vencimiento; las siguientes ocurrencias se derivan por frecuencia
  ocurrencias int check (ocurrencias > 0),   -- M total (para "N de M"); NULL = perpetuo (Poster, valet, nómina)
  sort_order  int not null default 0,        -- reordenable por arrastre (CRUD estilo inquilinos Uptown)
  archived    boolean not null default false,-- archivar detiene la generación futura, conserva historial
  created_at  timestamptz not null default now()
);
create index if not exists publico_previstos_live_idx on publico_previstos (sort_order) where not archived;

-- Un pago por (previsto, ocurrencia). Guarda el publico_costos creado → desmarcar lo revierte (borra ese costo).
create table if not exists publico_previsto_pagos (
  id          uuid primary key default gen_random_uuid(),
  previsto_id uuid not null references publico_previstos(id) on delete cascade,
  ocurrencia  date not null,                                              -- fecha de la ocurrencia pagada = llave de periodo
  costo_id    uuid references publico_costos(id) on delete set null,      -- el costo creado (para revertir)
  created_at  timestamptz not null default now(),
  unique (previsto_id, ocurrencia)
);
