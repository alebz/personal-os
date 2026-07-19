-- 0045_valet_collapse_advance.sql
-- FASE 1 del rediseño del valet: cada pago es solo PAGADO o PENDIENTE.
-- El tercer status 'advance' siempre se trató idéntico a 'paid' (isPaid = paid || advance) y el
-- toggle ya solo escribe paid/pending — 'advance' es legado. Un 'advance' ES un pago, así que
-- colapsarlo a 'paid' no pierde dinero ni información de cobro. ('cortesia' nunca existió: el CHECK
-- solo admite pending|paid|advance, así que no hay filas que limpiar de ese valor.)
--
-- REVERSIBLE: primero un respaldo completo. Para revertir → restaurar desde uptown_valet_payments_bak_0045.
-- Pre-flight opcional (corre esto antes para ver qué hay):
--   select status, count(*) from uptown_valet_payments group by status;

-- 1) Respaldo (snapshot de datos; rollback = restaurar de aquí)
create table if not exists uptown_valet_payments_bak_0045 as
  select * from uptown_valet_payments;

-- 2) Colapsar el legado
update uptown_valet_payments
  set status = 'paid', updated_at = now()
  where status = 'advance';

-- Nota: el CHECK sigue admitiendo 'advance' (inofensivo, ya nadie lo escribe). Se aprieta a
-- ('pending','paid') en la Fase 2, cuando la tabla se reestructura para soltar 'month'.
