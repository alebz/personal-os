-- 0034_tasks_metadata.sql
-- El quick-add del calendario guarda eventos como filas en `tasks` (kind='event')
-- con la fecha/hora en un `metadata` jsonb. La tabla `tasks` nunca tuvo esa
-- columna → PostgREST fallaba: "Could not find the 'metadata' column of 'tasks'
-- in the schema cache". Se agrega igual que en raw_captures / daily_logs.

alter table tasks
  add column if not exists metadata jsonb not null default '{}'::jsonb;
