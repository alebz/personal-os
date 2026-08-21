-- FACTURAS entrantes (CFDI) — captura automática desde el correo de Público. Un Apps Script en el Gmail de
-- publicogourmet manda el XML del CFDI al endpoint /api/publico/facturas/inbound; ahí se parsea y se deja EN
-- BANDEJA (status 'pendiente') para revisar/capturar. UUID = idempotencia (una factura no entra dos veces).
create table if not exists publico_facturas (
  uuid          text primary key,                  -- UUID del timbre (idempotencia)
  serie         text,
  folio         text,
  fecha         date,
  emisor_rfc    text,
  emisor_nombre text,                              -- el proveedor
  receptor_rfc  text,
  subtotal      numeric(14,2),
  total         numeric(14,2),
  conceptos     jsonb not null default '[]'::jsonb, -- [{descripcion,cantidad,unidad,valorUnitario,importe}]
  xml           text,                              -- el CFDI crudo (respaldo)
  status        text not null default 'pendiente', -- pendiente | capturada | ignorada
  ticket_scan_id uuid,                             -- si se capturó, el scan/rollup que generó
  email_msg_id  text,                              -- id del correo (traza)
  created_at    timestamptz not null default now()
);
create index if not exists publico_facturas_status_idx on publico_facturas (status, fecha desc);
alter table publico_facturas enable row level security;
