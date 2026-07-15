-- 0039_fondo_out_of_fixed_expenses.sql
-- Fondo Mantenimiento leaves "Gastos Fijos": aportar to your own fund is a TRANSFER, not a gasto.
-- The monthly contribution now lives only in the fund ledger (finance_movements, keyed by
-- source_key='uptown_fondo:<month>'); the uptown_fixed_expenses 'fondo' rows are retired.
-- Safe: the aportaciones were already backfilled into finance_movements (0037), so the fund balance
-- is unaffected ($16,000). NOTE: mergeExpenses appends orphan DB rows, so these MUST be deleted or
-- they'd keep showing in the list — this DELETE is required, not just cleanup.

delete from uptown_fixed_expenses where category = 'fondo';
