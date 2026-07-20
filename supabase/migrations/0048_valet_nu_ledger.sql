-- 0048_valet_nu_ledger.sql
-- FASE 3 del rediseño del valet: la libreta de la Cuenta Nu (dinero real), reusando el modelo de
-- fondos (finance_envelopes + finance_movements + FundLedger). El grid (celdas pagadas) y el
-- proveedor se reconstruyen 1:1 como movimientos fechados; una línea de ajuste cuadra el saldo
-- corrido con el saldo Nu real de HOY ($2,414). scope='uptown' → el filtro del Historial ya aísla
-- estos movimientos de Finanzas Alex (mismo mecanismo que mantenimiento; no hace falta scope por-mov).
--
-- Idempotente: todo lo insertado lleva source_key 'valet%' (nada más lo usa), así que re-correr es
-- seguro. REVERSIBLE: respaldos abajo + rollback de una línea (ver al final).
-- Criterio de fecha del backfill = el SÁBADO de cada semana (el histórico no tiene fecha de clic).

-- 1) Respaldos
create table if not exists uptown_valet_payments_bak_0048 as select * from uptown_valet_payments;
create table if not exists uptown_valet_config_bak_0048   as select * from uptown_valet_config;

-- 2) Limpieza idempotente
delete from finance_movements where source_key like 'valet%';

-- 3) Fondo Nu (operativo, sin meta; scope uptown)
insert into finance_envelopes (label, key, target, scope, sort_order)
values ('Cuenta Nu', 'valet_nu', null, 'uptown', 100)
on conflict (key) do update set scope = 'uptown', target = null, archived = false;

-- 4) COBROS: cada celda pagada → entrada a Nu (flow 'out'), fechada al sábado, monto = pts × precio/pt del mes
with nu as (select id from finance_envelopes where key = 'valet_nu'),
tenant(tid, pts, name) as (values
  ('publico_gourmet',3,'Público Gourmet'), ('barbajan',3,'Barbaján'),
  ('maison_zozoaga',3,'Maison Zozoaga'),   ('maricel',3,'Maricel''s Room'),
  ('arko',2,'Arko'), ('connect',2,'Connect'), ('east_garden',1,'The East Garden')
)
insert into finance_movements (month, date, description, amount, flow, category, envelope_id, source_key)
select
  to_char(p.week_date,'YYYY-MM'),
  p.week_date,
  'Cobro · ' || t.name || ' · ' || p.week_date,
  t.pts * coalesce(c.price_per_point, 176),
  'out', 'fondo', (select id from nu),
  'valet:' || p.week_date || ':' || p.tenant_id
from uptown_valet_payments p
join tenant t on t.tid = p.tenant_id
left join uptown_valet_config c on c.month = to_char(p.week_date,'YYYY-MM')
where p.status = 'paid';

-- 5) PROVEEDOR: cada semana marcada → salida de Nu (flow 'in'), $2,800 plano, fechada al sábado
with nu as (select id from finance_envelopes where key = 'valet_nu')
insert into finance_movements (month, date, description, amount, flow, category, envelope_id, source_key)
select
  c.month,
  d.week_date,
  'Pago proveedor · ' || d.week_date,
  2800, 'in', 'fondo', (select id from nu),
  'valet_prov:' || d.week_date
from uptown_valet_config c
cross join lateral (
  select coalesce(
    c.week1_date,
    (c.month||'-01')::date + ((6 - extract(dow from (c.month||'-01')::date)::int + 7) % 7)
  ) as base
) b
cross join lateral jsonb_array_elements(coalesce(c.provider_paid,'[]'::jsonb))
  with ordinality as e(val, ord)
cross join lateral (select b.base + ((e.ord - 1) * 7)::int as week_date) d
where e.val = 'true'::jsonb;

-- 5b) El proveedor de la semana del Sáb 27 jun (que se pagó el lun 29) fue $2,200, no $2,800
update finance_movements set amount = 2200 where source_key = 'valet_prov:2026-06-27';

-- 6) AJUSTE: cuadra el saldo corrido con el saldo Nu real de hoy ($2,414). Se salta si ya es exacto.
with nu as (select id from finance_envelopes where key='valet_nu'),
s as (select coalesce(sum(case when flow='out' then amount else -amount end),0) saved
        from finance_movements where envelope_id=(select id from nu)),
t as (select 2414::numeric as real),
o as (select coalesce(min(date),current_date) - 1 as d from finance_movements where envelope_id=(select id from nu))
insert into finance_movements (month, date, description, amount, flow, category, envelope_id, source_key)
select to_char((select d from o),'YYYY-MM'), (select d from o),
       'Ajuste de apertura · cuadre con saldo Nu real',
       abs((select real from t) - (select saved from s)),
       case when (select real from t) - (select saved from s) >= 0 then 'out' else 'in' end,
       'ajuste', (select id from nu), 'valet_adjust:opening'
where (select real from t) - (select saved from s) <> 0;

-- ── ROLLBACK (si algo no cuadra) ─────────────────────────────────────────────
--   delete from finance_movements where source_key like 'valet%';
--   delete from finance_envelopes where key='valet_nu';
--   (y si hiciera falta, restaurar de _bak_0048)
