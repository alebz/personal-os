-- 0037_funds_unified.sql
-- Unify the "fondo" concept: reuse finance_envelopes as a generic fund container
-- (label + optional target + ledger via finance_movements.envelope_id). A fund's
-- balance is the FLOW-AWARE sum of its movements (Σ in − Σ out). Caja Fuerte and
-- Fondo Mantenimiento become funds; the Vacaciones envelopes already are.
-- Start-from-current-balance:
--   • Caja Fuerte   → ONE opening movement = current finance_balance.caja_fuerte  ($30,000)
--   • Mantenimiento → BACKFILL one movement per already-paid uptown fondo month    (Σ = $16,000),
--     each linked via source_key so the Uptown toggle can upsert/delete idempotently
--     (mark → upsert, unmark → delete, no phantom balance).
-- Idempotent: safe to re-run.

-- (a) Generalize the container ------------------------------------------------
alter table finance_envelopes add column if not exists key text unique;              -- 'caja_fuerte' | 'mantenimiento' | null (vacaciones)
alter table finance_envelopes add column if not exists sort_order int not null default 0;
alter table finance_envelopes alter column target drop not null;                      -- null target = no meta (colchón)

-- (b) Allow fund movements + a reversible link to their source ----------------
alter table finance_movements drop constraint if exists finance_movements_category_check;
alter table finance_movements add constraint finance_movements_category_check
  check (category in ('nomina','freelance','gasto_fijo','gasto_extra','vacaciones','ajuste','fondo'));
alter table finance_movements add column if not exists source_key text;              -- e.g. 'uptown_fondo:2026-05'; null for manual movements
create unique index if not exists finance_movements_source_key_uidx
  on finance_movements (source_key) where source_key is not null;

-- (c) Create the two new funds ------------------------------------------------
insert into finance_envelopes (label, key, target) values
  ('Caja Fuerte',         'caja_fuerte',   null),
  ('Fondo Mantenimiento', 'mantenimiento', 50000)
on conflict (key) do nothing;

-- (d1) Caja Fuerte → single opening movement (= $30,000) ----------------------
insert into finance_movements (month, date, description, amount, flow, category, envelope_id)
select to_char(current_date,'YYYY-MM'), current_date, 'Saldo de apertura',
       (select caja_fuerte from finance_balance order by updated_at desc limit 1),
       'in', 'fondo', e.id
from finance_envelopes e
where e.key = 'caja_fuerte'
  and (select caja_fuerte from finance_balance order by updated_at desc limit 1) > 0
  and not exists (select 1 from finance_movements m where m.envelope_id = e.id);      -- idempotency guard

-- (d2) Mantenimiento → backfill one aportación per paid fondo month (Σ = $16,000)
insert into finance_movements (month, date, description, amount, flow, category, envelope_id, source_key)
select ufe.month, ufe.created_at::date, 'Aportación mensual',
       ufe.amount, 'in', 'fondo', e.id, 'uptown_fondo:'||ufe.month
from uptown_fixed_expenses ufe
cross join finance_envelopes e
where e.key = 'mantenimiento'
  and ufe.category = 'fondo' and ufe.paid = true and ufe.amount > 0
on conflict (source_key) where source_key is not null do nothing;                     -- idempotency guard
