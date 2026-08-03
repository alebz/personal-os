-- 0052_publico_gourmet.sql
-- Tercera isla financiera: Público Gourmet (restaurante, sociedad Alex+Andrés). Capa EJECUTIVA
-- sobre el POS (que solo imprime tickets). FASE 1: captura diaria + totales. Utilidad OPERATIVA
-- (ventas − insumos − nómina − gastos fijos); la bruta sería solo ventas − insumos (no es esta).
--
-- ORIGEN desde el día 1 (misma lección que "apartar sin origen": lo que no se captura no se
-- reconcilia después): las ventas van desglosadas por método y cada costo trae su contenedor.
-- Tres contenedores del negocio: CLIP (banco, caen ventas tarjeta), Caja chica, Caja POS (caen
-- ventas efectivo). En F1 son ATRIBUCIÓN por enum — NO fondos keyed (eso sería doble contabilidad).
-- Los fondos keyed + el ritual de cuadre (y la comisión de CLIP como costo real) llegan en F5.
--
-- scope='publico' marcado desde el día 1 (patrón de islas 'personal'|'uptown'). El multiusuario
-- real (compartir con Andrés) es proyecto aparte (F6): ahí se agrega user_id, el scope se queda.

-- Cierre de caja DIARIO — una fila por día (unique) → se edita, nunca se duplica.
create table if not exists publico_ventas (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  date       date not null,
  month      text not null,                                   -- 'YYYY-MM' denormalizado
  efectivo   numeric(12,2) not null default 0 check (efectivo >= 0),   -- → Caja POS
  tarjeta    numeric(12,2) not null default 0 check (tarjeta  >= 0),   -- → CLIP
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists publico_ventas_scope_date on publico_ventas (scope, date);

-- Costos itemizados, cada uno con ORIGEN (contenedor de donde salió) y naturaleza fijo/variable.
create table if not exists publico_costos (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'publico',
  date       date not null,
  month      text not null,
  category   text not null check (category in ('insumo','nomina','gasto_fijo','reinversion')),
  cost_kind  text check (cost_kind in ('fijo','variable')),   -- default por categoría; null = reinversión (excluida de operativo)
  origin     text not null check (origin in ('clip','caja_chica','caja_pos')),
  amount     numeric(12,2) not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists publico_costos_scope_month on publico_costos (scope, month);
