-- ── REPARACIÓN PREVIA ──────────────────────────────────────────────────────────
-- El check de categoría de publico_costos quedó congelado en 5 categorías (migración 0055) pero el código ya
-- usa 9 (agregó mantenimiento/empaque/suministros/comision). Hay filas con 'mantenimiento' → violan el
-- constraint viejo y bloquean cualquier migración que lo revalide. Lo alineamos con las 9 categorías del código.
alter table publico_costos drop constraint if exists publico_costos_category_check;
alter table publico_costos add constraint publico_costos_category_check
  check (category in ('insumo','nomina','gasto_fijo','mantenimiento','empaque','suministros','comision','reinversion','renta_condonada'));

-- INVENTARIO PROPIO de Público — el conteo físico vive en el OS, no en Poster.
-- El OS es DUEÑO del conteo y del food cost real; LEE de Poster (recetas, costo, unidad base); NO le escribe.
-- food cost real = (inventario inicial + compras − inventario final) ÷ ventas — con compras (tickets) y ventas
-- (Poster) que el OS ya tiene, el conteo es la tercera pata que lo cierra, sin depender del perpetuo roto de Poster.

-- Unidades de conteo por insumo (anti-pendejos): cuentas en lo que VES (caja/lata/kg), el sistema convierte.
-- La unidad BASE (kg/l/pza) y el costo salen de Poster en vivo; aquí solo viven las unidades de empaque + su factor.
--   count_units: [{ "label": "caja", "factor": 10 }, { "label": "lata", "factor": 2.5 }]   (factor = cuántas base son 1)
create table if not exists publico_insumo_unidades (
  ingredient_id  bigint primary key,               -- id del ingrediente de Poster
  count_units    jsonb  not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

-- Un conteo = una sesión física (un domingo). Sus líneas son el stock contado por insumo, ya valuado.
create table if not exists publico_conteos (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  nota        text,
  created_at  timestamptz not null default now()
);

create table if not exists publico_conteo_lineas (
  id               uuid primary key default gen_random_uuid(),
  conteo_id        uuid not null references publico_conteos(id) on delete cascade,
  ingredient_id    bigint not null,
  ingredient_name  text not null,
  base_unit        text not null,                   -- kg / l / pza (de Poster, congelado al momento del conteo)
  base_qty         numeric(14,4) not null default 0, -- cantidad total en unidad base
  unit_cost        numeric(14,4) not null default 0, -- $ por unidad base (prime_cost de Poster al momento)
  value            numeric(14,2) not null default 0, -- base_qty × unit_cost
  raw_counts       jsonb,                            -- lo tecleado por unidad: [{label, n}] — para auditar/editar
  unique(conteo_id, ingredient_id)
);

create index if not exists idx_conteo_lineas_conteo on publico_conteo_lineas(conteo_id);
