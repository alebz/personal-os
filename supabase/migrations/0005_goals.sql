-- 0005_goals.sql
-- Enforce at most one goals sentinel row.
-- Goals are stored on the fixed date 2000-01-01 so they never auto-clear.

create unique index if not exists daily_logs_goals_sentinel_idx
  on daily_logs (log_date)
  where kind = 'goals';
