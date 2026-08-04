-- 0056_uptown_renters.sql
-- Inquilinos de Uptown como DATOS (CRUD del usuario), no constantes en código. Antes cada alta/baja/
-- cambio de renta requería editar RENTER_DEFS a mano; ahora Alex los administra desde la UI.
--
-- Punto delicado (editar renta NO reescribe el pasado): `rent` es solo la SEMILLA/default para meses
-- que aún no tienen fila en uptown_rents. El monto REAL de cada mes ya está congelado en
-- uptown_rents.amount (snapshot por mes) → editar `rent` cambia meses futuros, nunca la historia.
-- `archived` = soft-delete (conserva el historial de pagos). Las keys migradas son las mismas que ya
-- usa uptown_rents.renter → todo el historial sigue ligado.

create table if not exists uptown_renters (
  id          text primary key,               -- key del inquilino (liga con uptown_rents.renter)
  name        text not null,
  location    text,                            -- editable (los locales cambian de nombre y de piso)
  rent        numeric(12,2) not null default 0 check (rent >= 0),   -- renta ACTUAL = semilla de meses nuevos
  start_month text,                            -- 'YYYY-MM' o null (desde cuándo está activo)
  sort_order  int not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Migrar los 7 inquilinos que viven en código (mismas keys → historial de pagos intacto).
insert into uptown_renters (id, name, location, rent, start_month, sort_order) values
  ('maison_zozoaga',  'Maison Zozoaga',  'PB',          10208, null,      0),
  ('arko',            'Arko',            'Planta alta', 10000, null,      1),
  ('maricel',         'Maricel''s Room', 'Planta alta', 10000, null,      2),
  ('connect',         'Connect',         'Planta alta',  7800, null,      3),
  ('barbajan',        'Barbaján',        'Sótano',      17000, '2026-07', 4),
  ('publico_gourmet', 'Público Gourmet', 'PB',              0, '2026-08', 5),
  ('naran_853',       'Narán 853',       'Torre Narán', 11500, null,      6)
on conflict (id) do nothing;
