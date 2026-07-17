-- 0043_envelopes_scope.sql
-- Each fund declares its scope ('personal' | 'uptown'); each section shows its own. Replaces the
-- by-name blacklist (key !== 'mantenimiento') with a structural rule that scales to several Uptown funds.
alter table finance_envelopes
  add column if not exists scope text not null default 'personal'
  check (scope in ('personal','uptown'));

-- Backfill: mantenimiento is Uptown's; everything else (emergencia, vacaciones, apartados) is personal (default).
update finance_envelopes set scope = 'uptown' where key = 'mantenimiento';
