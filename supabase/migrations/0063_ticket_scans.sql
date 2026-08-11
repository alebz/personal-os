-- Captura de gastos por FOTO del ticket (Público Gourmet). La IA PROPONE, el humano CONFIRMA, y hasta
-- entonces se materializa el gasto. Un scan 'pending' NO es un gasto: solo cuenta en finanzas cuando se
-- confirma y se escribe la fila roll-up en publico_costos. Alcance: Público (directo). Detalle itemizado
-- + roll-up de una línea por ticket (P&L intacto). Alias GLOBALES que aprenden de las correcciones.

-- Cabecera del escaneo: evidencia + extracción cruda + valores confirmados (editables).
create table if not exists ticket_scans (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null default 'publico',
  status        text not null default 'pending' check (status in ('pending','confirmed','discarded')),
  image_path    text,                       -- ruta en storage (evidencia); nullable en v1
  model         text,                       -- modelo que extrajo (auditoría)
  raw           jsonb,                      -- JSON crudo de la IA, TAL CUAL (antes de tus correcciones)
  proveedor     text,                       -- valor confirmado (editable)
  proveedor_raw text,                       -- lo que leyó la IA (para aprender el alias de proveedor)
  fecha         date,
  subtotal      numeric(12,2),
  descuento     numeric(12,2),
  impuestos     numeric(12,2),
  total         numeric(12,2),
  legibilidad   text,                       -- alta | media | baja (confianza de la IA)
  notas         text,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists ticket_scans_scope_status on ticket_scans (scope, status);

-- Líneas del ticket (itemización): detalle por producto + histórico de precios (alimenta F4 food-cost real).
create table if not exists ticket_items (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references ticket_scans(id) on delete cascade,
  pos             int not null default 0,   -- orden en el ticket
  codigo          text,
  descripcion     text not null,            -- texto canónico (tras alias / tu corrección)
  descripcion_raw text,                     -- lo que leyó la IA (para aprender el alias de producto)
  cantidad        numeric(12,3),
  unidad          text,
  precio_unitario numeric(12,2),
  importe         numeric(12,2) not null,
  es_descuento    boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists ticket_items_scan on ticket_items (scan_id);

-- Alias que aprenden de tus correcciones. GLOBALES (no por scope): "LCH ALP DES 1L" es leche en cualquier
-- lado. raw_norm = texto normalizado (mayúsculas, sin acentos, espacios colapsados) para el match exacto.
create table if not exists ticket_supplier_aliases (
  raw_norm    text primary key,
  proveedor   text not null,
  updated_at  timestamptz not null default now()
);
create table if not exists ticket_product_aliases (
  raw_norm     text primary key,
  descripcion  text not null,
  categoria    text,                        -- prellena publico_costos.category si aplica
  unidad       text,
  updated_at   timestamptz not null default now()
);

-- Enlace del roll-up: la fila resumen en publico_costos por ticket queda ligada a su scan. Nullable →
-- los gastos capturados a mano (sin foto) siguen igual, sin ticket_scan_id.
alter table publico_costos add column if not exists ticket_scan_id uuid references ticket_scans(id) on delete set null;
