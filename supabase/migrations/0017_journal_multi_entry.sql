-- Allow multiple journal entries per day by removing the unique constraint on entry_date.
alter table journal_entries
  drop constraint if exists journal_entries_entry_date_key;

-- Faster ordering by creation time
create index if not exists journal_entries_created_idx
  on journal_entries (created_at desc);
