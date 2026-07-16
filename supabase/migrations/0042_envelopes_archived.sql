-- 0042_envelopes_archived.sql
-- Soft-delete for finance_envelopes (funds/apartados) — the SAME pattern as habits (0035) and the
-- journal (0036). A fund's libreta is its value; "delete" must never wipe years of history. Archiving
-- hides the fund from the active view and drops it from the "guardado" sum, but keeps its movements
-- intact and is reversible (archived → false restores it with its full ledger).
--
-- Hard delete stays possible ONLY for empty funds (0 movements) — a capture typo, nothing to lose.
-- Additive column, default false → existing funds stay active, no backfill needed.
alter table finance_envelopes
  add column if not exists archived boolean not null default false;
