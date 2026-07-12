-- 0036_journal_soft_delete.sql
-- Soft-delete for journal entries — mirrors the habits pattern (0035). The journal is irreplaceable
-- content, so "delete" must never be a hard delete: we mark `archived = true` (hiding the entry from
-- reads and dropping its memory_chunk so it also leaves /brain and search) and can undo by flipping
-- it back (which re-indexes the chunk). Additive column, default false → existing entries stay
-- visible, no backfill needed.
alter table journal_entries
  add column if not exists archived boolean not null default false;
