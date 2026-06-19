-- 0008_uptown_fix.sql
-- Adds starting_balance to uptown_balance if it was created without it.

alter table uptown_balance
  add column if not exists starting_balance numeric(12,2) not null default 0;
