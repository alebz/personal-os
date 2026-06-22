-- 0018_commitments_meses.sql
-- Add installment support to finance_commitments.
-- meses = null  → recurring monthly (amount IS the monthly amount)
-- meses = N     → installment plan, monthly cost = amount / meses

alter table finance_commitments
  add column if not exists meses int check (meses is null or meses > 0);
