-- 0002_capture_routing.sql
-- Columns to support routing Telegram captures into tasks / daily_logs and
-- letting the user override the AI-assigned urgency via an inline keyboard tap.

-- Urgency: one of 'today' | 'this_week' | 'this_month' | 'someday'.

alter table tasks
  add column if not exists urgency text,
  add column if not exists kind text,
  add column if not exists source_capture_id uuid references raw_captures (id) on delete set null;

alter table daily_logs
  add column if not exists urgency text,
  add column if not exists kind text,
  add column if not exists entity_id uuid references entities (id) on delete set null,
  add column if not exists source_capture_id uuid references raw_captures (id) on delete set null;
