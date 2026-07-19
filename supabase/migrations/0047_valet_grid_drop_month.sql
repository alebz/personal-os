-- 0047_valet_grid_drop_month.sql
-- FASE 2 (paso final) — week_date es ahora la identidad del grid; se van month/week_num.
-- CORRE ESTO SOLO después de: (1) 0046 verificado (sin_fecha=0, colisiones=0), y (2) la UI ya
-- desplegada usando week_date. Antes de este paso el grid se VE bien (lee week_date) pero marcar
-- un pago falla (aún pide month/week_num NOT NULL) — este 0047 es lo que habilita el toggle.
-- REVERSIBLE: respaldo abajo + _bak_0046 sigue existiendo.

-- 0) Respaldo
create table if not exists uptown_valet_payments_bak_0047 as
  select * from uptown_valet_payments;

-- 1) Defensivo: por si quedó algún 'advance' (0045 ya los colapsó; inofensivo re-hacerlo)
update uptown_valet_payments set status = 'paid' where status = 'advance';

-- 2) week_date pasa a ser la identidad (con tenant_id)
alter table uptown_valet_payments alter column week_date set not null;
create unique index if not exists uptown_valet_payments_weekdate_tenant_uidx
  on uptown_valet_payments (week_date, tenant_id);

-- 3) Fuera la identidad vieja (month, week_num)
drop index if exists uptown_valet_payments_month_idx;
alter table uptown_valet_payments
  drop constraint if exists uptown_valet_payments_month_week_num_tenant_id_key;
alter table uptown_valet_payments
  drop column if exists month,
  drop column if exists week_num;

-- 4) Apretar el status a paid|pending (la Fase 1 lo dejó pendiente)
alter table uptown_valet_payments
  drop constraint if exists uptown_valet_payments_status_check;
alter table uptown_valet_payments
  add constraint uptown_valet_payments_status_check check (status in ('pending', 'paid'));
