-- 0009_uptown_fix2.sql
-- Adds any missing columns to uptown_balance created without the full schema.

alter table uptown_balance
  add column if not exists starting_balance numeric(12,2) not null default 0,
  add column if not exists cuenta_bancaria  numeric(12,2) not null default 0,
  add column if not exists efectivo         numeric(12,2) not null default 0;
