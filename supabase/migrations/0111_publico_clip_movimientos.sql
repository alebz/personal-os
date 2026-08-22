-- MOVIMIENTOS DE CLIP capturados por CORREO. La API pública de Clip solo expone dinero entrante (cobros,
-- depósitos, terminal): los cargos de la tarjeta y las transferencias salientes NO están ahí. Pero Clip avisa
-- por correo cada movimiento, y esos avisos se reenvían al Gmail de Público → Apps Script → /clip/aviso.
--
-- Esta tabla es el LIBRO DE LA CUENTA CLIP: lo que realmente entró y salió, independiente de lo que se haya
-- capturado a mano. Sirve para dos cosas:
--   1) Saber CUÁNDO se pagó una factura a crédito (Holbeer) → marca la factura como pagada, con su fecha real.
--   2) Ver qué salió de Clip y todavía no está en los libros (gasto sin registrar).
create table if not exists publico_clip_movimientos (
  id            uuid primary key default gen_random_uuid(),
  email_msg_id  text unique,                     -- un correo = un movimiento (idempotencia dura)
  referencia    text,                            -- No. de recibo (compra) / No. de referencia (transferencia)
  tipo          text not null check (tipo in ('compra','enviado','recibido')),
  es_gasto      boolean not null,                -- compra/enviado sacan dinero; recibido lo mete
  monto         numeric(14,2) not null check (monto > 0),
  fecha         date not null,                   -- día del movimiento en hora de México (no el del correo)
  contraparte   text,                            -- Establecimiento · Destinatario · Emisor
  descripcion   text,                            -- lo tecleado en la transferencia
  metodo        text,                            -- "VISA 8802 - Física" · "BAJIO *** 2057"
  raw           text,                            -- el cuerpo del aviso (respaldo para re-parsear)
  estado        text not null default 'pendiente' check (estado in ('pendiente','ligado','ignorado')),
  factura_uuid  text,                            -- si liquidó una factura a crédito
  costo_id      uuid,                            -- si ya corresponde a un gasto registrado
  created_at    timestamptz not null default now()
);
create index if not exists publico_clip_mov_fecha_idx  on publico_clip_movimientos (fecha desc);
create index if not exists publico_clip_mov_estado_idx on publico_clip_movimientos (estado, fecha desc);
create index if not exists publico_clip_mov_ref_idx    on publico_clip_movimientos (referencia);
alter table publico_clip_movimientos enable row level security;
