-- Traspasos entre contenedores (sacar efectivo del cajón POS a caja chica, depositar, etc.). Mismo PATRÓN que
-- el trasvase de la Caja Fuerte (un registro → dos efectos opuestos, net-cero, reversible), adaptado al modelo
-- DERIVADO de contenedores: UNA fila baja el origen y sube el destino por el mismo importe, vía flowSince.
-- NET-CERO para el negocio: NO es venta, NO es costo, NO es ingreso → no toca utilidad, food cost ni breakeven.
-- Solo mueve dinero de bolsillo a bolsillo. Reversible = borrar la fila (el flujo desaparece y los saldos vuelven).
create table if not exists publico_traspasos (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  origin     text not null check (origin  in ('clip', 'caja_chica', 'caja_pos')),
  destino    text not null check (destino in ('clip', 'caja_chica', 'caja_pos')),
  amount     numeric(14,2) not null check (amount > 0),
  fecha      date not null,
  nota       text,
  created_at timestamptz not null default now(),
  check (origin <> destino)   -- no tiene sentido traspasar a sí mismo
);
create index if not exists publico_traspasos_idx on publico_traspasos (fecha desc, created_at desc);
