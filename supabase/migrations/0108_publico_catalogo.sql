-- CATÁLOGO MAESTRO del OS ([[publico-catalogo-maestro-os]]). UNA lista de TODAS las cosas (ingredientes de
-- receta + consumibles + menaje), dueña del OS. El COSTO sale de TUS TICKETS (no de Poster: su prime_cost quedó
-- congelado al retirar el import de compras). Poster solo aporta la LISTA de ingredientes de receta (para poder
-- contarlos) — los que no has comprado arrancan sin costo (null) hasta que un ticket los cueste. La tabla se
-- SIEMBRA por endpoint (necesita jalar Poster + agregar los alias); aquí solo el esquema.
create table if not exists publico_catalogo (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  clase          text check (clase in ('comida','bebida','empaque','consumible','menaje','no_aplica')),  -- null = sin clasificar
  grupo          text,                              -- sección/orden del recorrido (lo que era "Organizar")
  unidad_base    text,                              -- kg · l · pza · bola…
  count_units    jsonb not null default '[]'::jsonb, -- [{label,factor}] unidades de conteo (lo que era "Unidades")
  costo          numeric(14,4),                     -- $/unidad base, DE TUS TICKETS. null = sin costo (hasta comprarlo)
  cuenta_stock   boolean not null default true,     -- false = consumible/menaje (gasto, no conteo físico)
  barcode        text,
  -- Procedencia (para seed idempotente + re-sync sin pisar tus ediciones):
  poster_ingredient_id  bigint,                     -- ligado a un ingrediente/reventa de Poster (o null = OS-nativo)
  poster_tipo    text,                              -- 'ingrediente' | 'reventa' | 'prepack' | null
  alias_raw_norm text,                              -- ligado a un alias de compra (raw_norm) o null
  activo         boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Unicidad por procedencia → el seed es idempotente (re-correr no duplica).
create unique index if not exists publico_catalogo_poster_uidx on publico_catalogo (poster_ingredient_id) where poster_ingredient_id is not null;
create unique index if not exists publico_catalogo_alias_uidx  on publico_catalogo (alias_raw_norm)       where alias_raw_norm is not null;

alter table publico_catalogo enable row level security;
