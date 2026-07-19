-- 0044_finance_movements_source_key.sql
-- Idempotency key for finance_movements that are SYNCED from another source rather than
-- entered by hand. First user: Uptown nómina — marking a week paid in Uptown mirrors a
-- wallet income into Finanzas Alex (cash→Efectivo, card→Tarjeta) so his balance actually
-- rises. The key `uptown_nomina:<month>:<week>` lets the mark/unmark create/delete exactly
-- one linked movement (delete-then-insert), with no orphans and no double-counting.
alter table finance_movements
  add column if not exists source_key text;

-- Non-partial unique index: Postgres treats NULLs as distinct, so hand-entered movements
-- (source_key null) are unconstrained; only synced keys must be unique.
create unique index if not exists finance_movements_source_key_uidx
  on finance_movements (source_key);
