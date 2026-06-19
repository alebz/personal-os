-- 0004_habits.sql
-- Enforce at most one habits record per calendar day.
-- The partial index on (log_date) WHERE kind = 'habits' means upsert logic
-- will always find exactly one row to update rather than creating duplicates.

create unique index if not exists daily_logs_habits_date_idx
  on daily_logs (log_date)
  where kind = 'habits';
