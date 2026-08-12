-- FASE 3 · Saldos de contenedores de Público (CLIP, caja chica, caja POS). Mismo patrón que finance_balance:
-- un SNAPSHOT (saldo contado + fecha) como baseline, y el saldo mostrado = último snapshot + flujos desde su
-- fecha. El baseline se siembra CONTANDO HOY (evita back-derivar a través de flujos incompletos). Un cuadre
-- inserta un snapshot nuevo con `esperado` (lo que el sistema mostraba) + `nota` (ajuste nombrado) → el delta
-- (saldo − esperado) queda auditado en la misma fila. Esto es CONTAR CAJONES; el cuadre del negocio es otra cosa.
create table if not exists publico_contenedor_saldos (
  id         uuid primary key default gen_random_uuid(),
  contenedor text not null check (contenedor in ('clip', 'caja_chica', 'caja_pos')),
  saldo      numeric(14,2) not null,       -- saldo CONTADO (real) en la fecha
  fecha      date not null,                -- fecha del conteo (baseline o cuadre)
  esperado   numeric(14,2),                -- lo que el sistema mostraba al contar (null en el baseline); delta = saldo − esperado
  nota       text,                         -- ajuste nombrado legible
  created_at timestamptz not null default now()
);
create index if not exists publico_contenedor_saldos_idx on publico_contenedor_saldos (contenedor, fecha desc, created_at desc);
