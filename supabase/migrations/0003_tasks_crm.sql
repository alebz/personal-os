-- 0003_tasks_crm.sql
-- CRM enhancements: key identifier, priority_score, tags array, entity_name display text

alter table tasks
  add column if not exists key            text,
  add column if not exists priority_score int,
  add column if not exists tags           text[] not null default '{}',
  add column if not exists entity_name    text;
