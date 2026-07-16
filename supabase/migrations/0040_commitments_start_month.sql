-- 0040_commitments_start_month.sql
-- Installment progression for finance_commitments.
--
-- CORRECTED model (supersedes the divisor wording in 0018):
--   amount      = the MONTHLY payment (what you pay each month)
--   meses       = the NUMBER of payments (the term); null = indefinite (subscription)
--   start_month = 'YYYY-MM', the month the plan began
--
-- "N de M" and the plan's end are DERIVED from the viewed month vs start_month
-- (no cron; advances by itself). meses=null → indefinite, start_month irrelevant.
-- The monthly cost is ALWAYS `amount` (never divided). Total of plan = amount * meses.

alter table finance_commitments
  add column if not exists start_month text;   -- 'YYYY-MM', null = legacy / indefinite

-- Backfill existing rows to their creation month (harmless for indefinite ones).
update finance_commitments
  set start_month = to_char(created_at, 'YYYY-MM')
  where start_month is null;
