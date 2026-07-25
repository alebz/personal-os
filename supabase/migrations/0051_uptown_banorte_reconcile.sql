-- 0051_uptown_banorte_reconcile.sql
-- FASE 2 del audit · Conciliación de Uptown por cuenta (camino a, ligero).
-- El saldo de Uptown sigue DERIVADO de los checks reales (rentas/gastos/nómina por mes), pero se
-- SEPARA por cuenta usando el `method` que cada flujo ya trae: card = Banorte, cash = Efectivo. Lo
-- único manual era editar el "Inicial" a mano para cuadrar contra el banco — ese fudge se MATA. En su
-- lugar: un ritual de conciliación por cuenta (Banorte vs estado de cuenta, Efectivo vs conteo físico
-- → diferencia → ajuste NOMBRADO) registrado como movimiento en un fondo de ajustes por cuenta,
-- reusando el modelo de fondos (finance_envelopes + finance_movements + FundLedger), idéntico a valet_nu.
--
-- NO migra los flujos operativos al fondo (eso sería el "Uptown completo como libreta", anotado como
-- evolución futura). Los fondos arrancan vacíos y solo acumulan ajustes — su libreta ES el historial
-- consultable de cuadres. Por cuenta:
--   saldoBanorte  = aperturaBanco + cobrado(card) − pagado(card) − apartado(card) + ajustes(mes)
--   saldoEfectivo = aperturaCash  + cobrado(cash) − pagado(cash) − apartado(cash) + ajustes(mes)
-- Convención: positivo = sobra (verde), negativo = falta (rojo). Apertura(mes) = saldo conciliado del
-- mes previo (uptown_balance.cuenta_bancaria / efectivo, campos que ya existen y hoy están en 0).
--
-- REVERSIBLE: respaldos abajo + rollback al final.

-- ── 1) Fondos de ajustes por cuenta (operativos, sin meta; scope uptown) ─────────
insert into finance_envelopes (label, key, target, scope, sort_order)
values ('Banorte',  'uptown_banorte',  null, 'uptown', 101),
       ('Efectivo', 'uptown_efectivo', null, 'uptown', 102)
on conflict (key) do update set scope = 'uptown', target = null, archived = false;

-- ── 2) Matar el sistema de conciliación VIEJO (huérfano, no sirve a camino a) ─────
-- uptown_reconciliations y uptown_cortes guardaban snapshots (esperado/real/diferencia) — el método
-- de foto que reemplazamos. Verificado: sin llamadores de UI. El único lector residual era
-- /api/uptown (last_corte_real), que se limpia en el mismo commit de código.
create table if not exists uptown_reconciliations_bak_0051 as select * from uptown_reconciliations;
create table if not exists uptown_cortes_bak_0051          as select * from uptown_cortes;

drop table if exists uptown_reconciliations;
drop table if exists uptown_cortes;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────────
--   delete from finance_movements where envelope_id in
--     (select id from finance_envelopes where key in ('uptown_banorte','uptown_efectivo'));
--   delete from finance_envelopes where key in ('uptown_banorte','uptown_efectivo');
--   create table uptown_reconciliations as select * from uptown_reconciliations_bak_0051;
--   create table uptown_cortes          as select * from uptown_cortes_bak_0051;
