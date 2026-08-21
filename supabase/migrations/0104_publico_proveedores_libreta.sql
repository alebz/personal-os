-- LIBRETA de proveedores: la tabla canónica (0103) crece a FICHA completa. Campos nuevos, todos aditivos y
-- nullable (no rompen filas ya sembradas):
--   tipo       — 'insumo' (compra variable: Costco, Sabor) | 'servicio' (suscripción/recurrente: Spotify, Poster,
--                luz) | null (sin clasificar). Distingue proveedor de compra vs de servicio en la libreta.
--   sort_order — para REACOMODAR la libreta a mano (default 0 → empata y cae al orden por uso/nombre).
--   telefono   — contacto directo.
--   contacto   — quién atiende / cómo se pide (texto corto).
--   notas      — la libreta libre (entregas, condiciones, avisos).
alter table publico_proveedores add column if not exists tipo       text;
alter table publico_proveedores add column if not exists sort_order integer not null default 0;
alter table publico_proveedores add column if not exists telefono   text;
alter table publico_proveedores add column if not exists contacto   text;
alter table publico_proveedores add column if not exists notas      text;
