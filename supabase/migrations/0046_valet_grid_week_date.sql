-- 0046_valet_grid_week_date.sql
-- FASE 2 (paso additive) — el grid del valet deja de ser (month, week_num) y pasa a fecha ABSOLUTA,
-- para que los adelantos sobrevivan al cambio de mes y el estado por-local salga solo del grid.
--
-- Este paso NO borra nada: agrega week_date y lo backfillea desde la fecha real de cada semana.
-- El drop de month/week_num va en 0047, SOLO después de que verifiques (ver checks al final) y de
-- que la UI ya use week_date. REVERSIBLE: respaldo abajo + las columnas viejas siguen intactas.
--
-- Criterio de fecha: el SÁBADO de esa semana = week1_date del mes + (week_num-1)*7. Si ese mes no
-- tiene week1_date, el primer sábado del mes. Es la misma fecha que la UI ya muestra por semana, y
-- la que usarán los movimientos de la libreta en la Fase 3.

-- 1) Respaldo de AMBAS tablas (rollback = restaurar de aquí). 0046 solo modifica payments,
--    pero respaldamos config también por precaución (se lee para el backfill).
create table if not exists uptown_valet_payments_bak_0046 as
  select * from uptown_valet_payments;
create table if not exists uptown_valet_config_bak_0046 as
  select * from uptown_valet_config;

-- 2) Nueva columna (nullable por ahora)
alter table uptown_valet_payments add column if not exists week_date date;

-- 3) Backfill: cada celda → el sábado de su semana
update uptown_valet_payments p
set week_date = (
  coalesce(
    (select c.week1_date from uptown_valet_config c where c.month = p.month),
    -- primer sábado del mes: día 1 + días hasta el próximo sábado (dow 6)
    ( (p.month || '-01')::date
      + ((6 - extract(dow from (p.month || '-01')::date)::int + 7) % 7) )
  ) + (p.week_num - 1) * 7
)
where week_date is null;

-- ── VERIFICA antes de seguir a 0047 (ambos deben dar 0 filas) ─────────────────
-- (a) ninguna quedó sin fecha:
--     select count(*) as sin_fecha from uptown_valet_payments where week_date is null;
-- (b) ninguna colisión (dos semanas distintas cayeron en la misma fecha para un local):
--     select week_date, tenant_id, count(*)
--       from uptown_valet_payments group by week_date, tenant_id having count(*) > 1;
-- Si (b) trae filas, no corras 0047 — me dices y lo resolvemos (probable week1_date raro en un mes).
