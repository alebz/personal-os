-- 0041_caja_fuerte_to_emergencia.sql
-- Step 3 of the Finanzas redesign: Caja Fuerte stops being "a card with a number" and becomes the
-- SECTION where every apartado/asset lives (each a fund with a ledger). The old key='caja_fuerte'
-- fund becomes just one apartado among many: the emergency fund.
--
-- Only the display label + ordering change here. The key='caja_fuerte' is PRESERVED (identity +
-- idempotency of the adjust endpoint). No column changes: the section is /funds minus mantenimiento.

update finance_envelopes
  set label = 'Fondo de emergencia', sort_order = 0
  where key = 'caja_fuerte';

-- Order the vacation envelopes (and any other keyless apartados) after the emergency fund.
update finance_envelopes
  set sort_order = 1
  where key is null and sort_order = 0;
