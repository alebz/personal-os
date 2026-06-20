-- Deduplicate first (keep latest row per date)
delete from daily_logs
where id not in (
  select distinct on (log_date) id
  from daily_logs
  order by log_date, created_at desc
);

-- Add unique constraint so we can upsert nutrition data per day
alter table daily_logs
  add constraint daily_logs_log_date_key unique (log_date);
